import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosExpedientes.js';
import * as datosConvocatorias from '../convocatorias/accesoDatosConvocatorias.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';
import { obtenerPool, sql } from '../../configuracion/baseDatos.js';
import { calcularPuntajePonderado, calcularPuntajeTotal } from '../../utilidades/calculoEvaluacion.js';

async function obtenerExpedienteOFallar(idExpediente) {
  const expediente = await datos.obtenerExpedientePorId(idExpediente);
  if (!expediente) throw errorNoEncontrado('El expediente no existe.');
  return expediente;
}

export async function listarExpedientes(filtros) {
  return datos.listarExpedientes(filtros);
}

export async function obtenerExpediente(idExpediente) {
  const expediente = await obtenerExpedienteOFallar(idExpediente);
  const [documentos, historial, evaluacion] = await Promise.all([
    datos.listarDocumentosExpediente(idExpediente),
    datos.obtenerHistorialExpediente(idExpediente),
    datos.obtenerEvaluacionVigente(idExpediente)
  ]);
  return { ...expediente, documentos, historial, evaluacion };
}

async function obtenerUsuarioDelEmpleado(idEmpleado) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idEmpleado)
    .query('SELECT IdUsuario FROM dbo.Empleados WHERE IdEmpleado = @id');
  return resultado.recordset[0]?.IdUsuario || null;
}

export async function asignarExpediente(idExpediente, idEmpleado, idAsignadoPor) {
  await obtenerExpedienteOFallar(idExpediente);
  if (!idEmpleado) throw errorValidacion('Debe indicar el empleado responsable.');

  await datos.asignarExpediente(idExpediente, idEmpleado, idAsignadoPor);

  const idUsuarioEmpleado = await obtenerUsuarioDelEmpleado(idEmpleado);
  if (idUsuarioEmpleado) {
    await crearNotificacion(null, {
      idUsuario: idUsuarioEmpleado,
      tipo: 'EXPEDIENTE_ASIGNADO',
      titulo: 'Expediente asignado',
      mensaje: `Se le asignó el expediente #${idExpediente} para revisión.`,
      enlace: `/trabajo-social/expedientes/${idExpediente}`
    });
  }

  return obtenerExpediente(idExpediente);
}

export async function revisarDocumento(idExpediente, idDocumento, { estado, observacion }, idRevisor) {
  const estadosValidos = ['VALIDO', 'RECHAZADO', 'REQUIERE_SUBSANACION'];
  if (!estadosValidos.includes(estado)) throw errorValidacion('El estado de revisión no es válido.');

  const documento = await datos.obtenerDocumentoDeExpediente(idExpediente, idDocumento);
  if (!documento) throw errorNoEncontrado('El documento no pertenece a este expediente.');

  await datos.registrarRevisionDocumento({
    idDocumentoSolicitud: idDocumento,
    idRevisor,
    estadoAnterior: documento.Estado,
    estadoNuevo: estado,
    observacion
  });

  return obtenerExpediente(idExpediente);
}

export async function solicitarSubsanacion(idExpediente, { observacion }, idUsuario) {
  const expediente = await obtenerExpedienteOFallar(idExpediente);
  if (expediente.Estado !== 'EN_REVISION_DOCUMENTAL') {
    throw errorConflicto('Solo se puede solicitar subsanación mientras el expediente está en revisión documental.');
  }

  await datos.cambiarEstadoExpedienteYSolicitud(idExpediente, 'PENDIENTE_SUBSANACION');
  await datos.registrarHistorialExpediente({
    idExpediente, estadoAnterior: expediente.Estado, estadoNuevo: 'PENDIENTE_SUBSANACION', idUsuario, observacion
  });

  await crearNotificacion(null, {
    idUsuario: expediente.IdUsuario,
    tipo: 'SUBSANACION_SOLICITADA',
    titulo: 'Debe subsanar documentos',
    mensaje: observacion || 'Se solicitó la corrección de uno o más documentos de su solicitud.',
    enlace: `/aspirante/solicitudes/${expediente.IdSolicitud}/documentos`
  });
  await enviarCorreo({
    idUsuario: expediente.IdUsuario,
    correoDestino: expediente.CorreoAspirante,
    asunto: 'Debe subsanar documentos - SGBE CUC',
    tipoMensaje: 'SUBSANACION_SOLICITADA',
    contenidoHtml: `<p>${observacion || 'Se solicitó la corrección de uno o más documentos de su solicitud.'}</p>`
  });

  return obtenerExpediente(idExpediente);
}

export async function resolverElegibilidad(idExpediente, { esElegible, motivo }, idUsuario) {
  const expediente = await obtenerExpedienteOFallar(idExpediente);
  if (!['EN_REVISION_DOCUMENTAL', 'PENDIENTE_SUBSANACION'].includes(expediente.Estado)) {
    throw errorConflicto('La elegibilidad solo puede resolverse durante la revisión documental.');
  }

  if (esElegible) {
    const documentos = await datos.listarDocumentosExpediente(idExpediente);
    const convocatoria = await datosConvocatorias.obtenerConvocatoriaPorId(expediente.IdConvocatoria);
    const requisitosObligatorios = convocatoria.requisitos.filter((requisito) => requisito.Obligatorio);
    const faltantesOInvalidos = requisitosObligatorios.filter((requisito) => {
      const documento = documentos.find((doc) => doc.IdRequisito === requisito.IdRequisito);
      return !documento || documento.Estado !== 'VALIDO';
    });
    if (faltantesOInvalidos.length > 0) {
      throw errorValidacion('No se puede declarar elegible: existen documentos obligatorios pendientes, rechazados o faltantes.', [
        ...faltantesOInvalidos.map((r) => ({ campo: 'documentos', mensaje: `Documento pendiente: ${r.Nombre}.` }))
      ]);
    }
  } else if (!motivo?.trim()) {
    throw errorValidacion('Debe indicar el motivo de la no elegibilidad.');
  }

  await datos.registrarElegibilidad({ idExpediente, esElegible, motivo, idResueltoPor: idUsuario });

  const estadoNuevo = esElegible ? 'ELEGIBLE' : 'NO_ELEGIBLE';
  await datos.cambiarEstadoExpedienteYSolicitud(idExpediente, estadoNuevo);
  await datos.registrarHistorialExpediente({
    idExpediente, estadoAnterior: expediente.Estado, estadoNuevo, idUsuario, observacion: motivo
  });

  await crearNotificacion(null, {
    idUsuario: expediente.IdUsuario,
    tipo: 'ELEGIBILIDAD_RESUELTA',
    titulo: esElegible ? 'Su solicitud es elegible' : 'Su solicitud no es elegible',
    mensaje: esElegible
      ? 'Su solicitud cumplió los requisitos y continúa a la etapa de evaluación.'
      : `Su solicitud no cumplió los requisitos. Motivo: ${motivo}`,
    enlace: `/aspirante/solicitudes/${expediente.IdSolicitud}/resultado`
  });

  return obtenerExpediente(idExpediente);
}

export async function obtenerEvaluacion(idExpediente) {
  await obtenerExpedienteOFallar(idExpediente);
  const [evaluacion, componentes] = await Promise.all([
    datos.obtenerEvaluacionVigente(idExpediente),
    datos.listarComponentesEvaluacion()
  ]);
  return { evaluacion, componentes };
}

export async function guardarEvaluacion(idExpediente, { puntajes }, idEvaluador) {
  const expediente = await obtenerExpedienteOFallar(idExpediente);
  if (expediente.Estado !== 'ELEGIBLE') {
    throw errorConflicto('Solo se puede evaluar un expediente declarado elegible.');
  }

  const componentes = await datos.listarComponentesEvaluacion();
  const sumaPorcentajes = componentes.reduce((total, componente) => total + Number(componente.Porcentaje), 0);
  if (Math.round(sumaPorcentajes) !== 100) {
    throw errorConflicto('La suma de los porcentajes de los componentes de evaluación debe ser 100.');
  }

  if (!Array.isArray(puntajes) || puntajes.length !== componentes.length) {
    throw errorValidacion('Debe registrar el puntaje de todos los componentes de evaluación.');
  }

  const puntajesPorComponente = componentes.map((componente) => {
    const entrada = puntajes.find((p) => Number(p.idComponente) === componente.IdComponente);
    if (!entrada || entrada.puntaje === undefined || entrada.puntaje === null) {
      throw errorValidacion(`Falta el puntaje del componente ${componente.Nombre}.`);
    }
    const puntaje = Number(entrada.puntaje);
    if (Number.isNaN(puntaje) || puntaje < 0 || puntaje > Number(componente.PuntajeMaximo)) {
      throw errorValidacion(`El puntaje de ${componente.Nombre} debe estar entre 0 y ${componente.PuntajeMaximo}.`);
    }
    const puntajePonderado = calcularPuntajePonderado(puntaje, componente.Porcentaje);
    return {
      idComponente: componente.IdComponente,
      puntaje,
      porcentaje: componente.Porcentaje,
      puntajePonderado,
      observacion: entrada.observacion
    };
  });

  const puntajeTotal = calcularPuntajeTotal(puntajesPorComponente.map((item) => item.puntajePonderado));

  await datos.guardarEvaluacion({ idExpediente, idEvaluador, puntajeTotal, puntajesPorComponente });
  await datos.cambiarEstadoExpedienteYSolicitud(idExpediente, 'EVALUADA');
  await datos.registrarHistorialExpediente({
    idExpediente, estadoAnterior: expediente.Estado, estadoNuevo: 'EVALUADA', idUsuario: idEvaluador,
    observacion: `Puntaje total: ${puntajeTotal}`
  });
  await datos.recalcularRankingConvocatoria(expediente.IdConvocatoria);

  return obtenerExpediente(idExpediente);
}

export async function enviarComite(idExpediente, idUsuario) {
  const expediente = await obtenerExpedienteOFallar(idExpediente);
  if (expediente.Estado !== 'EVALUADA') {
    throw errorConflicto('Solo un expediente evaluado puede enviarse al comité.');
  }
  await datos.cambiarEstadoExpedienteYSolicitud(idExpediente, 'EN_COMITE');
  await datos.registrarHistorialExpediente({
    idExpediente, estadoAnterior: expediente.Estado, estadoNuevo: 'EN_COMITE', idUsuario, observacion: null
  });
  return obtenerExpediente(idExpediente);
}
