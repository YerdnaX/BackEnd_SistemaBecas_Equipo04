import { errorValidacion, errorNoEncontrado, errorConflicto, errorProhibido } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosDisciplinario.js';
import { obtenerParametro } from '../../servicios-compartidos/servicioParametros.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { registrarAuditoria } from '../../servicios-compartidos/servicioAuditoria.js';
import { enviarNotificacionPlantilla } from '../../servicios-compartidos/servicioNotificacionesTransaccionales.js';

// Traduccion de resultado de negocio (spec Segmento 03) a los valores
// almacenados en dbo.ResolucionesSuspension.Resultado, que ya existian
// con otro nombre desde el modelo original: MANTENER = SIN_MERITO,
// SUSPENDER = SUSPENDIDA, CANCELAR = CANCELADA.
const MAPA_RESULTADO_A_DB = { MANTENER: 'SIN_MERITO', SUSPENDER: 'SUSPENDIDA', CANCELAR: 'CANCELADA' };
const MAPA_RESULTADO_A_ESTADO_BECA = { MANTENER: 'ACTIVA', SUSPENDER: 'SUSPENDIDA', CANCELAR: 'CANCELADA' };

async function obtenerInvestigacionOFallar(idInvestigacion) {
  const investigacion = await datos.obtenerInvestigacionPorId(idInvestigacion);
  if (!investigacion) throw errorNoEncontrado('La investigación no existe.');
  return investigacion;
}

export async function abrirInvestigacion(idBecaActiva, { causal, descripcion }, usuario) {
  if (!causal?.trim()) throw errorValidacion('Debe indicar la causal del incumplimiento.');

  const beca = await datos.obtenerBecaActivaPorId(idBecaActiva);
  if (!beca) throw errorNoEncontrado('La beca activa no existe.');
  if (beca.SoloLectura) throw errorConflicto('El expediente está cerrado y no admite nuevos procesos.');
  if (beca.Estado !== 'ACTIVA') throw errorConflicto('Solo se puede investigar una beca activa.');

  const abierta = await datos.obtenerInvestigacionAbiertaPorBeca(idBecaActiva);
  if (abierta) throw errorConflicto('Ya existe un proceso disciplinario en trámite para esta beca.');

  const idInvestigacion = await datos.crearInvestigacion({
    idBecaActiva,
    causal,
    descripcion,
    idResponsable: usuario.idEmpleado ?? null
  });

  await registrarAuditoria({
    idUsuario: usuario.idUsuario,
    modulo: 'DISCIPLINARIO',
    accion: 'INVESTIGACION_ABIERTA',
    entidad: 'InvestigacionBeca',
    idEntidad: idInvestigacion,
    detalle: causal
  });

  const plazoDias = await obtenerParametro('SUSPENSION_PLAZO_DESCARGOS_DIAS', 8);
  await crearNotificacion(null, {
    idUsuario: beca.IdUsuario,
    tipo: 'INVESTIGACION_ABIERTA',
    titulo: 'Se abrió un proceso de revisión sobre su beca',
    mensaje: `Se detectó una posible causal: "${causal}". Tiene ${plazoDias} días hábiles para presentar sus descargos.`,
    enlace: `/becado/descargos/${idInvestigacion}`
  });
  await enviarNotificacionPlantilla('INVESTIGACION_ABIERTA', beca.IdUsuario, { causal, plazoDias });

  return obtenerInvestigacionOFallar(idInvestigacion);
}

export async function listarInvestigaciones(filtros, usuario) {
  const filtrosFinales = { ...filtros };
  if (!usuario.permisos.includes('DISCIPLINARIO_GESTIONAR')) filtrosFinales.idUsuario = usuario.idUsuario;
  return datos.listarInvestigaciones(filtrosFinales);
}

export async function obtenerInvestigacion(idInvestigacion, usuario) {
  const investigacion = await obtenerInvestigacionOFallar(idInvestigacion);
  const puedeGestionar = usuario.permisos.includes('DISCIPLINARIO_GESTIONAR');
  if (!puedeGestionar && investigacion.IdUsuario !== usuario.idUsuario) {
    throw errorProhibido('No tiene acceso a este proceso.');
  }
  const descargos = await datos.listarDescargos(idInvestigacion);
  return { ...investigacion, descargos };
}

export async function presentarDescargo(idInvestigacion, { detalle, idArchivo }, usuario) {
  if (!detalle?.trim()) throw errorValidacion('Debe indicar el detalle del descargo.');

  const investigacion = await obtenerInvestigacionOFallar(idInvestigacion);
  if (investigacion.IdUsuario !== usuario.idUsuario) throw errorProhibido('Solo puede presentar descargos sobre su propio proceso.');
  if (investigacion.Estado !== 'EN_REVISION') throw errorConflicto('El proceso no está recibiendo descargos en este momento.');

  const plazoDias = await obtenerParametro('SUSPENSION_PLAZO_DESCARGOS_DIAS', 8);
  const fechaLimite = new Date(investigacion.FechaApertura);
  fechaLimite.setDate(fechaLimite.getDate() + plazoDias);
  if (new Date() > fechaLimite) throw errorConflicto(`El plazo de ${plazoDias} días para presentar descargos ya venció.`);

  await datos.crearDescargo({ idInvestigacion, idUsuario: usuario.idUsuario, detalle, idArchivo });

  await registrarAuditoria({
    idUsuario: usuario.idUsuario,
    modulo: 'DISCIPLINARIO',
    accion: 'DESCARGO_PRESENTADO',
    entidad: 'InvestigacionBeca',
    idEntidad: idInvestigacion
  });

  return obtenerInvestigacion(idInvestigacion, usuario);
}

export async function pasarAAnalisis(idInvestigacion, usuario) {
  const investigacion = await obtenerInvestigacionOFallar(idInvestigacion);
  if (investigacion.Estado !== 'EN_REVISION') throw errorConflicto('Solo se puede pasar a análisis un proceso que está en revisión.');
  if (investigacion.FechaAnalisis) throw errorConflicto('Este proceso ya fue pasado a análisis.');
  await datos.pasarAAnalisis(idInvestigacion);
  await registrarAuditoria({
    idUsuario: usuario.idUsuario,
    modulo: 'DISCIPLINARIO',
    accion: 'PASO_A_ANALISIS',
    entidad: 'InvestigacionBeca',
    idEntidad: idInvestigacion
  });
  return obtenerInvestigacionOFallar(idInvestigacion);
}

export async function resolverInvestigacion(idInvestigacion, { resultado, motivo }, idResueltoPor) {
  const investigacion = await obtenerInvestigacionOFallar(idInvestigacion);
  if (!['EN_REVISION'].includes(investigacion.Estado)) {
    throw errorConflicto('El proceso ya fue resuelto o cerrado.');
  }
  if (!MAPA_RESULTADO_A_DB[resultado]) {
    throw errorValidacion('El resultado debe ser MANTENER, SUSPENDER o CANCELAR.');
  }

  await datos.resolverInvestigacionTransaccion({
    idInvestigacion,
    idBecaActiva: investigacion.IdBecaActiva,
    resultadoDb: MAPA_RESULTADO_A_DB[resultado],
    estadoBecaNuevo: MAPA_RESULTADO_A_ESTADO_BECA[resultado],
    motivo,
    idResueltoPor
  });

  await registrarAuditoria({
    idUsuario: idResueltoPor,
    modulo: 'DISCIPLINARIO',
    accion: `RESUELTO_${resultado}`,
    entidad: 'InvestigacionBeca',
    idEntidad: idInvestigacion,
    detalle: motivo?.slice(0, 400)
  });

  await crearNotificacion(null, {
    idUsuario: investigacion.IdUsuario,
    tipo: 'INVESTIGACION_RESUELTA',
    titulo: 'Se resolvió el proceso de revisión de su beca',
    mensaje: `Resultado: ${resultado}. ${motivo ? `Motivo: ${motivo}` : ''}`.trim(),
    enlace: `/becado/descargos/${idInvestigacion}`
  });
  await enviarNotificacionPlantilla('INVESTIGACION_RESUELTA', investigacion.IdUsuario, {
    resultado,
    motivo: motivo || 'Sin observaciones adicionales.'
  });

  return obtenerInvestigacionOFallar(idInvestigacion);
}
