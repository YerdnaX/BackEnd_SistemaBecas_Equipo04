import { errorConflicto, errorNoEncontrado, errorProhibido, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { evaluarPermanencia, validarEnvioRenovacion, validarResultadoRenovacion } from '../../utilidades/reglasSegmentoDos.js';
import { crearNotificacionCompleta as crearNotificacion } from '../../servicios-compartidos/servicioNotificacionesEventos.js';
import { obtenerParametro } from '../../servicios-compartidos/servicioParametros.js';
import { guardarArchivo, obtenerArchivo } from '../../servicios-compartidos/servicioArchivos.js';
import * as datos from './accesoDatosSeguimiento.js';

export async function listarSeguimientos(idBeca) {
  return datos.listarSeguimientos(idBeca);
}

export async function registrarSeguimiento(idBeca, usuario, entrada) {
  if (!entrada.periodo?.trim()) throw errorValidacion('El periodo es obligatorio.');
  if (!['PENDIENTE', 'CUMPLE', 'NO_CUMPLE'].includes(entrada.estado || 'PENDIENTE')) {
    throw errorValidacion('El estado del seguimiento no es valido.');
  }
  const propietario = await datos.obtenerPropietarioBeneficio(idBeca);
  if (!propietario) throw errorNoEncontrado('El becado no existe.');
  return { idSeguimiento: await datos.crearSeguimiento(idBeca, usuario.idUsuario, entrada) };
}

export async function registrarRendimiento(idBeca, usuario, entrada) {
  const promedio = Number(entrada.promedio);
  if (!entrada.periodo?.trim() || !Number.isFinite(promedio) || promedio < 0 || promedio > 100) {
    throw errorValidacion('El periodo y un promedio entre 0 y 100 son obligatorios.');
  }
  const enteros = ['creditosMatriculados', 'creditosAprobados', 'cursosPerdidos'];
  if (enteros.some((campo) => !Number.isInteger(Number(entrada[campo] || 0)) || Number(entrada[campo] || 0) < 0)) {
    throw errorValidacion('Los creditos y cursos perdidos deben ser numeros enteros no negativos.');
  }
  if (Number(entrada.creditosAprobados || 0) > Number(entrada.creditosMatriculados || 0)) {
    throw errorValidacion('Los creditos aprobados no pueden superar los creditos matriculados.');
  }
  const propietario = await datos.obtenerPropietarioBeneficio(idBeca);
  if (!propietario) throw errorNoEncontrado('El becado no existe.');
  const [promedioMinimo, creditosMinimos] = await Promise.all([
    obtenerParametro('PROMEDIO_MINIMO_PERMANENCIA', 70),
    obtenerParametro('CREDITOS_MINIMOS_PERMANENCIA', 9)
  ]);
  const evaluacion = evaluarPermanencia(entrada, { promedioMinimo, creditosMinimos });
  const idSeguimiento = await datos.crearRendimiento(idBeca, usuario.idUsuario, entrada, evaluacion);
  if (!evaluacion.cumple) {
    await crearNotificacion(null, {
      idUsuario: propietario.IdUsuario,
      tipo: 'ALERTA_SEGUIMIENTO',
      titulo: 'Alerta de seguimiento',
      mensaje: 'Su rendimiento requiere revision. Consulte el panel y contacte a Bienestar Estudiantil.',
      enlace: '/becado'
    });
  }
  return { idSeguimiento, evaluacion };
}

export const listarAlertas = (idBeca) => datos.listarAlertas(idBeca);

export async function crearAlerta(idBeca, entrada) {
  if (!entrada.tipo?.trim() || !entrada.descripcion?.trim()) {
    throw errorValidacion('El tipo y la descripcion son obligatorios.');
  }
  if (!['INFO', 'ADVERTENCIA', 'CRITICO'].includes(entrada.nivel || 'ADVERTENCIA')) {
    throw errorValidacion('El nivel de la alerta no es valido.');
  }
  const propietario = await datos.obtenerPropietarioBeneficio(idBeca);
  if (!propietario) throw errorNoEncontrado('El becado no existe.');
  const idAlerta = await datos.crearAlerta(idBeca, entrada);
  if (!idAlerta) throw errorConflicto('Debe registrar primero un seguimiento.');
  await crearNotificacion(null, {
    idUsuario: propietario.IdUsuario,
    tipo: 'ALERTA_SEGUIMIENTO',
    titulo: 'Nueva alerta de seguimiento',
    mensaje: entrada.descripcion,
    enlace: '/becado'
  });
  return { idAlerta };
}

export async function cerrarAlerta(id, entrada) {
  const cerrada = await datos.cerrarAlerta(id, entrada.observacion);
  if (!cerrada) throw errorConflicto('La alerta no existe o ya fue atendida.');
}

export const listarJustificaciones = (usuario) => datos.listarJustificacionesPropias(usuario.idUsuario);
export const listarJustificacionesTrabajoSocial = (filtros) => datos.listarJustificaciones(filtros);

export async function crearJustificacion(usuario, entrada) {
  const beneficio = await datos.obtenerBeneficioPropio(usuario.idUsuario);
  if (!beneficio) throw errorNoEncontrado('No existe un beneficio asociado a su cuenta.');
  if (!entrada.periodo?.trim() || !entrada.curso?.trim() || !entrada.motivo?.trim()) {
    throw errorValidacion('El periodo, curso y motivo son obligatorios.');
  }
  if (entrada.periodo !== beneficio.Periodo) {
    throw errorValidacion('El curso debe pertenecer al periodo vigente del beneficio.');
  }
  if (!entrada.archivo) throw errorValidacion('Debe adjuntar un documento de respaldo.');
  const idArchivo = await guardarArchivo(entrada.archivo);
  return {
    idJustificacion: await datos.crearJustificacion(beneficio.IdBecaActiva, entrada, idArchivo)
  };
}

export async function obtenerJustificacion(id, usuario) {
  const justificacion = await datos.obtenerJustificacion(id);
  if (!justificacion) throw errorNoEncontrado('La justificacion no existe.');
  if (justificacion.IdUsuario !== usuario.idUsuario && !usuario.permisos.includes('JUSTIFICACION_RESOLVER')) {
    throw errorProhibido();
  }
  return justificacion;
}

export async function obtenerArchivoJustificacion(id, usuario) {
  const justificacion = await obtenerJustificacion(id, usuario);
  if (!justificacion.IdArchivo) throw errorNoEncontrado('La justificacion no tiene un archivo adjunto.');
  const archivo = await obtenerArchivo(justificacion.IdArchivo);
  if (!archivo) throw errorNoEncontrado('El archivo adjunto no existe.');
  return archivo;
}

export async function resolverJustificacion(id, usuario, entrada) {
  const justificacion = await obtenerJustificacion(id, usuario);
  if (!['APROBADA', 'RECHAZADA'].includes(entrada.estado) || !entrada.resolucion?.trim()) {
    throw errorValidacion('El estado y la resolucion son obligatorios.');
  }
  if (justificacion.Estado !== 'PENDIENTE') {
    if (justificacion.Estado === entrada.estado && justificacion.Resolucion === entrada.resolucion.trim()) {
      return justificacion;
    }
    throw errorConflicto('La justificacion ya fue resuelta.');
  }
  const resuelta = await datos.resolverJustificacion(id, usuario.idUsuario, entrada);
  if (!resuelta) throw errorConflicto('La justificacion ya fue resuelta.');
  await crearNotificacion(null, {
    idUsuario: justificacion.IdUsuario,
    tipo: 'JUSTIFICACION_RESUELTA',
    titulo: 'Justificacion resuelta',
    mensaje: `La justificacion del curso ${justificacion.Curso} fue ${entrada.estado.toLowerCase()}.`,
    enlace: '/becado/justificaciones'
  });
  return datos.obtenerJustificacion(id);
}

export async function disponibilidadRenovacion(usuario) {
  const [periodo, beneficio] = await Promise.all([
    datos.obtenerPeriodoRenovacionAbierto(),
    datos.obtenerBeneficioPropio(usuario.idUsuario)
  ]);
  const renovacionExistente = periodo && beneficio
    ? await datos.obtenerRenovacionPorBecaPeriodo(beneficio.IdBecaActiva, periodo.Periodo)
    : null;
  return {
    disponible: Boolean(periodo && beneficio?.Estado === 'ACTIVA' && !renovacionExistente),
    periodo,
    beneficio,
    renovacionExistente
  };
}

export async function obtenerRenovacion(id, usuario) {
  const renovacion = await datos.obtenerRenovacion(id);
  if (!renovacion) throw errorNoEncontrado('La renovacion no existe.');
  if (renovacion.IdUsuario !== usuario.idUsuario && !usuario.permisos.includes('RENOVACION_RESOLVER')) {
    throw errorProhibido();
  }
  let datosActualizados = {};
  try {
    datosActualizados = renovacion.DatosActualizados
      ? JSON.parse(renovacion.DatosActualizados)
      : {};
  } catch {
    datosActualizados = {};
  }
  return { ...renovacion, datosActualizados };
}

export async function crearRenovacion(usuario, entrada) {
  const disponibilidad = await disponibilidadRenovacion(usuario);
  if (disponibilidad.renovacionExistente) {
    return obtenerRenovacion(disponibilidad.renovacionExistente.IdRenovacion, usuario);
  }
  if (!disponibilidad.disponible) {
    throw errorConflicto('No existe un periodo de renovacion abierto para este beneficio.');
  }
  const resultadoCreacion = await datos.crearRenovacion(
    disponibilidad.beneficio.IdBecaActiva,
    disponibilidad.periodo.Periodo,
    entrada.datosActualizados
  );
  const renovacion = await obtenerRenovacion(resultadoCreacion.idRenovacion, usuario);
  if (resultadoCreacion.creada) {
    await crearNotificacion(null, {
      idUsuario: usuario.idUsuario,
      tipo: 'RENOVACION_ABIERTA',
      titulo: 'Renovacion iniciada',
      mensaje: `El periodo ${renovacion.Periodo} se encuentra abierto y su borrador esta disponible.`,
      enlace: `/becado/renovaciones/${resultadoCreacion.idRenovacion}`
    });
  }
  return renovacion;
}

export async function actualizarRenovacion(id, usuario, entrada) {
  const renovacion = await obtenerRenovacion(id, usuario);
  const enviar = entrada.enviar === true;
  const validacion = validarEnvioRenovacion({
    estado: renovacion.Estado,
    enviar,
    datosActualizados: entrada.datosActualizados,
    cantidadDocumentos: renovacion.documentos?.length
  });
  if (validacion.idempotente) return renovacion;
  const actualizada = await datos.actualizarRenovacion(id, entrada.datosActualizados, enviar);
  if (!actualizada) throw errorConflicto('La renovacion ya no se encuentra en borrador.');
  if (enviar) {
    await crearNotificacion(null, {
      idUsuario: usuario.idUsuario,
      tipo: 'RENOVACION_ENVIADA',
      titulo: 'Renovacion enviada',
      mensaje: `Su renovacion del periodo ${renovacion.Periodo} fue enviada a reevaluacion.`,
      enlace: `/becado/renovaciones/${id}`
    });
  }
  return obtenerRenovacion(id, usuario);
}

export async function agregarDocumentoRenovacion(id, usuario, entrada) {
  const renovacion = await obtenerRenovacion(id, usuario);
  if (renovacion.Estado !== 'BORRADOR') {
    throw errorConflicto('Solo se pueden adjuntar documentos mientras la renovacion esta en borrador.');
  }
  if (!entrada.archivo) throw errorValidacion('Debe adjuntar un archivo.');
  const idArchivo = await guardarArchivo(entrada.archivo);
  if (!await datos.agregarDocumentoRenovacion(id, idArchivo, entrada.idTipoDocumento)) {
    throw errorConflicto('La renovacion ya no se encuentra en borrador.');
  }
  return obtenerRenovacion(id, usuario);
}

export async function obtenerArchivoRenovacion(id, idDocumento, usuario) {
  await obtenerRenovacion(id, usuario);
  const documento = await datos.obtenerDocumentoRenovacion(id, idDocumento);
  if (!documento) throw errorNoEncontrado('El documento no pertenece a esta renovacion.');
  const archivo = await obtenerArchivo(documento.IdArchivo);
  if (!archivo) throw errorNoEncontrado('El archivo de renovacion no existe.');
  return archivo;
}

export const listarRenovacionesTrabajoSocial = (filtros) => datos.listarRenovaciones(filtros);

export async function evaluarRenovacion(id, usuario, entrada) {
  const renovacion = await obtenerRenovacion(id, usuario);
  if (renovacion.Estado !== 'EN_REEVALUACION') throw errorConflicto('La renovacion no esta en reevaluacion.');
  await datos.evaluarRenovacion(id, usuario.idUsuario, entrada);
  return obtenerRenovacion(id, usuario);
}

export async function resolverRenovacion(id, usuario, entrada) {
  validarResultadoRenovacion(entrada.resultado, entrada.porcentajeNuevo);
  const resultado = await datos.resolverRenovacion(id, usuario.idUsuario, entrada);
  if (!resultado) throw errorConflicto('La renovacion requiere evaluacion y no debe estar resuelta.');
  await crearNotificacion(null, {
    idUsuario: resultado.idUsuario,
    tipo: 'RENOVACION_RESUELTA',
    titulo: 'Renovacion resuelta',
    mensaje: `El resultado de su renovacion es ${entrada.resultado}.`,
    enlace: `/becado/renovaciones/${id}`
  });
  return obtenerRenovacion(id, usuario);
}
