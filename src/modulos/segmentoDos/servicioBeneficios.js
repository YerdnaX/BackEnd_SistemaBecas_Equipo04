import {
  errorConflicto,
  errorNoEncontrado,
  errorProhibido,
  errorValidacion
} from '../../utilidades/errorAplicacion.js';
import {
  esActualizacionSensible,
  filtrarActualizacionesExpediente
} from '../../utilidades/reglasSegmentoDos.js';
import { crearNotificacionCompleta as crearNotificacion } from '../../servicios-compartidos/servicioNotificacionesEventos.js';
import { crearPdfSimple } from '../../utilidades/crearPdfSimple.js';
import * as datos from './accesoDatosBeneficios.js';

export async function obtenerFormalizacion(idSolicitud, usuario) {
  let formalizacion = await datos.obtenerFormalizacionSolicitud(idSolicitud, usuario.idUsuario);
  if (!formalizacion?.IdFormalizacion) {
    const id = await datos.prepararFormalizacion(idSolicitud, usuario.idUsuario);
    if (!id) throw errorNoEncontrado('No existe una resolucion aprobada y vigente para formalizar.');
    formalizacion = await datos.obtenerFormalizacionSolicitud(idSolicitud, usuario.idUsuario);
  }
  return formalizacion;
}

export async function aceptarCondiciones(idSolicitud, usuario, entrada, direccionIp) {
  if (entrada.acepta !== true) {
    throw errorValidacion('Debe aceptar expresamente las condiciones para continuar.');
  }
  const formalizacion = await obtenerFormalizacion(idSolicitud, usuario);
  if (formalizacion.Estado === 'ACEPTADA') {
    return {
      idFormalizacion: formalizacion.IdFormalizacion,
      idBecaActiva: formalizacion.IdBecaActiva,
      idempotente: true
    };
  }
  const resultado = await datos.aceptarFormalizacion(idSolicitud, usuario.idUsuario, direccionIp);
  if (!resultado) throw errorNoEncontrado('La formalizacion no existe.');
  await crearNotificacion(null, {
    idUsuario: usuario.idUsuario,
    tipo: 'FORMALIZACION_COMPLETADA',
    titulo: 'Formalizacion completada',
    mensaje: 'Las condiciones y el convenio fueron aceptados. El beneficio pasa a validacion.',
    enlace: `/aspirante/solicitudes/${idSolicitud}/formalizacion`
  });
  return resultado;
}

export async function obtenerConvenio(idSolicitud, usuario) {
  const convenio = await datos.obtenerConvenioSolicitud(idSolicitud, usuario.idUsuario);
  if (!convenio) throw errorNoEncontrado('El convenio no existe.');
  return convenio;
}

export async function obtenerArchivoConvenio(idSolicitud, usuario) {
  const convenio = await obtenerConvenio(idSolicitud, usuario);
  return {
    NombreOriginal: `${convenio.NumeroConvenio}.pdf`,
    TipoMime: 'application/pdf',
    Contenido: crearPdfSimple([
      'SGBE - CUC',
      `Convenio ${convenio.NumeroConvenio}`,
      `Version de condiciones: ${convenio.VersionCondiciones}`,
      `Estudiante: ${convenio.Estudiante}`,
      `Expediente: ${convenio.CodigoExpediente}`,
      `Resolucion: ${convenio.NumeroResolucion}`,
      `Porcentaje de beca: ${Number(convenio.PorcentajeBeca)}%`,
      '',
      convenio.Contenido,
      '',
      convenio.Firmado
        ? `Aceptado electronicamente el ${new Date(convenio.FechaFirma).toLocaleString('es-CR')}.`
        : 'Pendiente de aceptacion electronica.'
    ])
  };
}

export async function confirmarConvenio(idSolicitud, usuario, entrada, direccionIp) {
  return aceptarCondiciones(idSolicitud, usuario, { ...entrada, acepta: true }, direccionIp);
}

export async function obtenerBeneficio(idBeneficio) {
  const beneficio = await datos.obtenerBeneficio(idBeneficio);
  if (!beneficio) throw errorNoEncontrado('El beneficio no existe.');
  return beneficio;
}

export const listarBeneficios = () => datos.listarBeneficios();

export async function validarAcademicamente(idBeneficio, usuario, entrada) {
  if (!entrada.periodo?.trim()) throw errorValidacion('El periodo es obligatorio.');
  const beneficio = await obtenerBeneficio(idBeneficio);
  if (entrada.periodo.trim() !== beneficio.Periodo) {
    throw errorValidacion('La validacion academica debe corresponder al periodo vigente del beneficio.');
  }
  const estado = entrada.estado === 'FALLIDO' ? 'RECHAZADA' : 'VALIDADA';
  const propietario = await datos.registrarValidacionAcademica(idBeneficio, usuario.idUsuario, {
    ...entrada,
    estado
  });
  if (!propietario) throw errorNoEncontrado('El beneficio no existe.');
  await crearNotificacion(null, {
    idUsuario: propietario.IdUsuario,
    tipo: 'VALIDACION_ACADEMICA',
    titulo: estado === 'VALIDADA' ? 'Informacion academica validada' : 'Validacion academica pendiente',
    mensaje: entrada.detalle || `La validacion academica quedo en estado ${estado}.`,
    enlace: '/becado'
  });
  return obtenerBeneficio(idBeneficio);
}

export async function activarFinancieramente(idBeneficio, usuario, entrada) {
  const porcentaje = Number(entrada.porcentaje);
  if (!entrada.periodo?.trim()) throw errorValidacion('El periodo es obligatorio.');
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    throw errorValidacion('El porcentaje debe estar entre 0 y 100.');
  }
  const beneficio = await obtenerBeneficio(idBeneficio);
  if (entrada.periodo.trim() !== beneficio.Periodo) {
    throw errorValidacion('La aplicacion financiera debe corresponder al periodo vigente del beneficio.');
  }
  const resultado = await datos.aplicarFinancieramente(idBeneficio, usuario.idUsuario, {
    ...entrada,
    porcentaje
  });
  if (!resultado) throw errorNoEncontrado('El beneficio no existe.');
  if (resultado.Estado === 'VERIFICADA') {
    return { ...resultado, idempotente: true };
  }
  await crearNotificacion(null, {
    idUsuario: beneficio.IdUsuario,
    tipo: resultado.Estado === 'RECHAZADA' ? 'ACTIVACION_FINANCIERA_FALLIDA' : 'APLICACION_FINANCIERA',
    titulo: resultado.Estado === 'RECHAZADA' ? 'La aplicacion financiera requiere revision' : 'Aplicacion financiera registrada',
    mensaje: resultado.Estado === 'RECHAZADA'
      ? (entrada.detalleError || 'Finanzas reporto un fallo durante la aplicacion.')
      : 'El beneficio fue aplicado y se encuentra pendiente de verificacion.',
    enlace: '/becado'
  });
  return { ...resultado, idempotente: true };
}

export async function verificarAplicacion(idBeneficio) {
  const resultado = await datos.verificarAplicacionFinanciera(idBeneficio);
  if (!resultado) {
    throw errorConflicto('La aplicacion requiere validacion academica y un registro financiero pendiente de verificacion.');
  }
  if (!resultado.yaVerificada) {
    await crearNotificacion(null, {
      idUsuario: resultado.idUsuario,
      tipo: 'BENEFICIO_ACTIVO',
      titulo: 'Beca activa',
      mensaje: 'La aplicacion financiera fue verificada y su beneficio se encuentra activo.',
      enlace: '/becado'
    });
  }
  return obtenerBeneficio(idBeneficio);
}

export async function obtenerPanel(usuario) {
  const panel = await datos.obtenerPanelBecado(usuario.idUsuario);
  if (!panel) throw errorNoEncontrado('No existe un beneficio asociado a su cuenta.');
  return panel;
}

export async function obtenerExpediente(usuario) {
  const expediente = await datos.obtenerExpedienteBecado(usuario.idUsuario);
  if (!expediente) throw errorNoEncontrado('No existe un expediente de becado asociado a su cuenta.');
  return expediente;
}

export async function actualizarExpediente(usuario, entrada) {
  const expediente = await obtenerExpediente(usuario);
  const cambios = filtrarActualizacionesExpediente(entrada);
  if (Object.keys(cambios).length === 0) {
    throw errorValidacion('No se enviaron campos editables.');
  }
  const camposExpediente = {
    telefono: 'Telefono',
    direccion: 'Direccion',
    contactoEmergencia: 'ContactoEmergencia',
    telefonoEmergencia: 'TelefonoEmergencia',
    situacionLaboral: 'SituacionLaboral',
    observaciones: 'Observaciones'
  };
  const cambiosReales = Object.entries(cambios).filter(([campo, valor]) => {
    const valorActual = expediente[camposExpediente[campo]];
    return (valor ?? '') !== (valorActual ?? '');
  });
  for (const [campo, valor] of cambiosReales) {
    const actualizado = await datos.actualizarCampoExpediente(
      usuario.idUsuario,
      expediente.IdExpediente,
      campo,
      valor,
      esActualizacionSensible(campo)
    );
    if (!actualizado) throw errorProhibido();
  }
  return obtenerExpediente(usuario);
}

export async function listarHistorialExpediente(usuario) {
  await obtenerExpediente(usuario);
  return datos.listarHistorialExpediente(usuario.idUsuario);
}
