import { errorValidacion, errorNoEncontrado, errorConflicto, errorProhibido } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosApelaciones.js';
import { obtenerParametro } from '../../servicios-compartidos/servicioParametros.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { registrarAuditoria } from '../../servicios-compartidos/servicioAuditoria.js';
import { enviarNotificacionPlantilla } from '../../servicios-compartidos/servicioNotificacionesTransaccionales.js';

function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

async function obtenerApelacionOFallar(idApelacion) {
  const apelacion = await datos.obtenerApelacionPorId(idApelacion);
  if (!apelacion) throw errorNoEncontrado('La apelación no existe.');
  return apelacion;
}

export async function presentarApelacion(idResolucion, { motivo, idsArchivos = [] }, usuario) {
  if (!motivo?.trim()) throw errorValidacion('Debe indicar el motivo de la apelación.');

  const resolucion = await datos.obtenerResolucionParaApelar(idResolucion);
  if (!resolucion) throw errorNoEncontrado('La resolución indicada no existe.');
  if (resolucion.IdUsuario !== usuario.idUsuario) throw errorProhibido('Solo puede apelar sus propias resoluciones.');
  if (!resolucion.Publicada) throw errorConflicto('La resolución todavía no ha sido notificada y no es apelable.');
  if (resolucion.SoloLectura) throw errorConflicto('El expediente está cerrado y no admite apelaciones.');

  const apelacionActiva = await datos.obtenerApelacionActivaPorResolucion(idResolucion);
  if (apelacionActiva) throw errorConflicto('Ya existe una apelación activa para esta resolución.');

  const plazoDias = await obtenerParametro('APELACION_PLAZO_DIAS', 10);
  const fechaLimiteResolucion = sumarDias(resolucion.FechaEmision, plazoDias);
  const dentroDePlazo = new Date() <= fechaLimiteResolucion;

  let idApelacion;
  if (!dentroDePlazo) {
    idApelacion = await datos.crearApelacionRechazadaPorPlazo({
      idExpediente: resolucion.IdExpediente,
      idResolucion,
      motivo
    });
    await registrarAuditoria({
      idUsuario: usuario.idUsuario,
      modulo: 'APELACIONES',
      accion: 'RECHAZADA_POR_PLAZO',
      entidad: 'Apelacion',
      idEntidad: idApelacion
    });
    throw errorConflicto(`El plazo de ${plazoDias} días para apelar esta resolución ya venció. La apelación quedó registrada como rechazada por plazo.`);
  }

  idApelacion = await datos.crearApelacion({
    idExpediente: resolucion.IdExpediente,
    idResolucion,
    motivo,
    fechaLimite: fechaLimiteResolucion
  });

  for (const idArchivo of idsArchivos) {
    await datos.agregarDocumentoApelacion(idApelacion, idArchivo);
  }

  await registrarAuditoria({
    idUsuario: usuario.idUsuario,
    modulo: 'APELACIONES',
    accion: 'PRESENTADA',
    entidad: 'Apelacion',
    idEntidad: idApelacion
  });

  return obtenerApelacionOFallar(idApelacion);
}

export async function listarApelaciones(filtros, usuario) {
  const filtrosFinales = { ...filtros };
  const esPropietario = !usuario.permisos.includes('APELACION_LISTAR');
  if (esPropietario) filtrosFinales.idUsuario = usuario.idUsuario;
  return datos.listarApelaciones(filtrosFinales);
}

export async function obtenerApelacion(idApelacion, usuario) {
  const apelacion = await obtenerApelacionOFallar(idApelacion);
  const puedeVerTodas = usuario.permisos.includes('APELACION_LISTAR');
  if (!puedeVerTodas && apelacion.IdUsuario !== usuario.idUsuario) {
    throw errorProhibido('No tiene acceso a esta apelación.');
  }
  const documentos = await datos.listarDocumentosApelacion(idApelacion);
  return { ...apelacion, documentos };
}

export async function asignarRevisorApelacion(idApelacion, idRevisor, idAsignadoPor) {
  const apelacion = await obtenerApelacionOFallar(idApelacion);
  if (!['RECIBIDA', 'EN_REVISION'].includes(apelacion.Estado)) {
    throw errorConflicto('Solo se puede asignar revisor a apelaciones en trámite.');
  }
  if (!idRevisor) throw errorValidacion('Debe indicar el revisor.');

  await datos.asignarRevisor(idApelacion, idRevisor);
  await registrarAuditoria({
    idUsuario: idAsignadoPor,
    modulo: 'APELACIONES',
    accion: 'REVISOR_ASIGNADO',
    entidad: 'Apelacion',
    idEntidad: idApelacion,
    detalle: `Revisor asignado: usuario ${idRevisor}`
  });
  return obtenerApelacionOFallar(idApelacion);
}

export async function resolverApelacion(idApelacion, { aFavor, motivo, nuevoPorcentaje, observaciones }, idResueltoPor) {
  const apelacion = await obtenerApelacionOFallar(idApelacion);
  if (!['RECIBIDA', 'EN_REVISION'].includes(apelacion.Estado)) {
    throw errorConflicto('La apelación ya fue resuelta.');
  }
  if (aFavor === undefined || aFavor === null) throw errorValidacion('Debe indicar si la apelación se resuelve a favor o en contra.');

  await datos.registrarRevisionApelacion(idApelacion, idResueltoPor, observaciones);

  await datos.resolverApelacionTransaccion({
    idApelacion,
    idExpediente: apelacion.IdExpediente,
    idResolucion: apelacion.IdResolucion,
    aFavor,
    resultado: aFavor ? 'MODIFICADA' : 'CONFIRMADA',
    motivo,
    nuevoPorcentaje: aFavor ? nuevoPorcentaje : undefined,
    idResueltoPor
  });

  await registrarAuditoria({
    idUsuario: idResueltoPor,
    modulo: 'APELACIONES',
    accion: aFavor ? 'RESUELTA_A_FAVOR' : 'RESUELTA_EN_CONTRA',
    entidad: 'Apelacion',
    idEntidad: idApelacion,
    detalle: motivo?.slice(0, 400)
  });

  await crearNotificacion(null, {
    idUsuario: apelacion.IdUsuario,
    tipo: 'APELACION_RESUELTA',
    titulo: 'Su apelación fue resuelta',
    mensaje: aFavor
      ? 'Su apelación fue resuelta a favor. La resolución fue modificada.'
      : 'Su apelación fue resuelta en contra. Se confirma la resolución original.',
    enlace: `/apelaciones/${idApelacion}`
  });

  await enviarNotificacionPlantilla('APELACION_RESUELTA', apelacion.IdUsuario, {
    resultado: aFavor ? 'a favor' : 'en contra',
    motivo: motivo || 'Sin observaciones adicionales.'
  });

  return obtenerApelacionOFallar(idApelacion);
}
