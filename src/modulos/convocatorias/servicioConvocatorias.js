import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosConvocatorias.js';
import * as datosTiposBeca from '../tiposBeca/accesoDatosTiposBeca.js';

function validarDatosConvocatoria({ idTipoBeca, nombre, fechaInicio, fechaFin, cupos, presupuesto }) {
  const errores = [];
  if (!idTipoBeca) errores.push({ campo: 'idTipoBeca', mensaje: 'El tipo de beca es obligatorio.' });
  if (!nombre?.trim()) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
  if (!fechaInicio || !fechaFin) {
    errores.push({ campo: 'fechaFin', mensaje: 'Las fechas de inicio y fin son obligatorias.' });
  } else if (new Date(fechaFin) <= new Date(fechaInicio)) {
    errores.push({ campo: 'fechaFin', mensaje: 'La fecha final debe ser posterior a la fecha inicial.' });
  }
  if (!Number(cupos) || Number(cupos) <= 0) errores.push({ campo: 'cupos', mensaje: 'Los cupos deben ser mayores que cero.' });
  if (presupuesto !== undefined && Number(presupuesto) < 0) {
    errores.push({ campo: 'presupuesto', mensaje: 'El presupuesto no puede ser negativo.' });
  }
  if (errores.length > 0) throw errorValidacion('Revise los datos de la convocatoria.', errores);
}

export async function listarConvocatorias(filtros) {
  return datos.listarConvocatorias(filtros);
}

export async function obtenerConvocatoria(idConvocatoria) {
  const convocatoria = await datos.obtenerConvocatoriaPorId(idConvocatoria);
  if (!convocatoria) throw errorNoEncontrado('La convocatoria no existe.');
  return convocatoria;
}

export async function crearConvocatoria(datosEntrada, idCreadoPor) {
  validarDatosConvocatoria(datosEntrada);
  const tipoBeca = await datosTiposBeca.obtenerTipoBecaPorId(datosEntrada.idTipoBeca);
  if (!tipoBeca || !tipoBeca.Activo) {
    throw errorValidacion('El tipo de beca seleccionado no está disponible.', [
      { campo: 'idTipoBeca', mensaje: 'Seleccione un tipo de beca activo.' }
    ]);
  }
  const idConvocatoria = await datos.crearConvocatoria({ ...datosEntrada, idCreadoPor });
  return obtenerConvocatoria(idConvocatoria);
}

export async function actualizarConvocatoria(idConvocatoria, datosEntrada) {
  validarDatosConvocatoria(datosEntrada);
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  if (convocatoria.Estado !== 'BORRADOR') {
    throw errorConflicto('Solo se puede editar una convocatoria en estado BORRADOR.');
  }
  await datos.actualizarConvocatoria(idConvocatoria, datosEntrada);
  return obtenerConvocatoria(idConvocatoria);
}

export async function enviarAprobacion(idConvocatoria) {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  if (convocatoria.Estado !== 'BORRADOR') {
    throw errorConflicto('Solo una convocatoria en BORRADOR puede enviarse a aprobación.');
  }
  await datos.cambiarEstadoConvocatoria(idConvocatoria, 'PENDIENTE_APROBACION');
  return obtenerConvocatoria(idConvocatoria);
}

export async function aprobarConvocatoria(idConvocatoria, idAprobadoPor) {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  if (convocatoria.Estado !== 'PENDIENTE_APROBACION') {
    throw errorConflicto('Solo una convocatoria pendiente de aprobación puede aprobarse.');
  }
  await datos.cambiarEstadoConvocatoria(idConvocatoria, 'APROBADA', idAprobadoPor);
  return obtenerConvocatoria(idConvocatoria);
}

export async function publicarConvocatoria(idConvocatoria) {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  if (convocatoria.Estado !== 'APROBADA') {
    throw errorConflicto('Solo una convocatoria aprobada puede publicarse.');
  }
  if (!convocatoria.requisitos || convocatoria.requisitos.length === 0) {
    throw errorValidacion('La convocatoria debe tener al menos un requisito activo para publicarse.');
  }
  await datos.cambiarEstadoConvocatoria(idConvocatoria, 'PUBLICADA');
  return obtenerConvocatoria(idConvocatoria);
}

export async function listarEtapas(idConvocatoria) {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  return convocatoria.etapas;
}

export async function actualizarEtapa(idConvocatoria, idEtapa, { fechaInicio, fechaFin, estado }, idUsuario) {
  const etapaActual = await datos.obtenerEtapaPorId(idConvocatoria, idEtapa);
  if (!etapaActual) throw errorNoEncontrado('La etapa no existe.');

  const estadosValidos = ['PROGRAMADA', 'ABIERTA', 'CERRADA'];
  if (!estadosValidos.includes(estado)) {
    throw errorValidacion('El estado de la etapa no es válido.');
  }
  if (fechaFin && fechaInicio && new Date(fechaFin) <= new Date(fechaInicio)) {
    throw errorValidacion('La fecha final de la etapa debe ser posterior a la inicial.');
  }

  const etapaActualizada = await datos.actualizarEtapa(idConvocatoria, idEtapa, {
    fechaInicio: fechaInicio || etapaActual.FechaInicio,
    fechaFin: fechaFin || etapaActual.FechaFin,
    estado
  });

  await datos.registrarHistorialEtapa({
    idEtapa,
    estadoAnterior: etapaActual.Estado,
    estadoNuevo: estado,
    idUsuario,
    observacion: null
  });

  return etapaActualizada;
}
