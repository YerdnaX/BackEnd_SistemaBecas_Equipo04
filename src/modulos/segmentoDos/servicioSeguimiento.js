import { errorConflicto, errorNoEncontrado, errorProhibido, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { evaluarPermanencia, validarResultadoRenovacion } from '../../utilidades/reglasSegmentoDos.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { guardarArchivo } from '../../servicios-compartidos/servicioArchivos.js';
import * as datos from './accesoDatosSeguimiento.js';

export async function listarSeguimientos(idBeca) {
  return datos.listarSeguimientos(idBeca);
}

export async function registrarSeguimiento(idBeca, usuario, entrada) {
  if (!entrada.periodo?.trim()) throw errorValidacion('El periodo es obligatorio.');
  const propietario = await datos.obtenerPropietarioBeneficio(idBeca);
  if (!propietario) throw errorNoEncontrado('El becado no existe.');
  return { idSeguimiento: await datos.crearSeguimiento(idBeca, usuario.idUsuario, entrada) };
}

export async function registrarRendimiento(idBeca, usuario, entrada) {
  const promedio = Number(entrada.promedio);
  if (!entrada.periodo?.trim() || !Number.isFinite(promedio) || promedio < 0 || promedio > 100) {
    throw errorValidacion('El periodo y un promedio entre 0 y 100 son obligatorios.');
  }
  const propietario = await datos.obtenerPropietarioBeneficio(idBeca);
  if (!propietario) throw errorNoEncontrado('El becado no existe.');
  const evaluacion = evaluarPermanencia(entrada);
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

export const cerrarAlerta = (id, entrada) => datos.cerrarAlerta(id, entrada.observacion);

export const listarJustificaciones = (usuario) => datos.listarJustificacionesPropias(usuario.idUsuario);

export async function crearJustificacion(usuario, entrada) {
  const beneficio = await datos.obtenerBeneficioPropio(usuario.idUsuario);
  if (!beneficio) throw errorNoEncontrado('No existe un beneficio asociado a su cuenta.');
  if (!entrada.periodo?.trim() || !entrada.curso?.trim() || !entrada.motivo?.trim()) {
    throw errorValidacion('El periodo, curso y motivo son obligatorios.');
  }
  if (entrada.periodo !== beneficio.Periodo) {
    throw errorValidacion('El curso debe pertenecer al periodo vigente del beneficio.');
  }
  let idArchivo = null;
  if (entrada.archivo) idArchivo = await guardarArchivo(entrada.archivo);
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

export async function resolverJustificacion(id, usuario, entrada) {
  const justificacion = await obtenerJustificacion(id, usuario);
  if (!['APROBADA', 'RECHAZADA'].includes(entrada.estado) || !entrada.resolucion?.trim()) {
    throw errorValidacion('El estado y la resolucion son obligatorios.');
  }
  await datos.resolverJustificacion(id, usuario.idUsuario, entrada);
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
  return {
    disponible: Boolean(periodo && beneficio?.Estado === 'ACTIVA'),
    periodo,
    beneficio
  };
}

export async function obtenerRenovacion(id, usuario) {
  const renovacion = await datos.obtenerRenovacion(id);
  if (!renovacion) throw errorNoEncontrado('La renovacion no existe.');
  if (renovacion.IdUsuario !== usuario.idUsuario && !usuario.permisos.includes('RENOVACION_RESOLVER')) {
    throw errorProhibido();
  }
  return renovacion;
}

export async function crearRenovacion(usuario, entrada) {
  const disponibilidad = await disponibilidadRenovacion(usuario);
  if (!disponibilidad.disponible) {
    throw errorConflicto('No existe un periodo de renovacion abierto para este beneficio.');
  }
  const idRenovacion = await datos.crearRenovacion(
    disponibilidad.beneficio.IdBecaActiva,
    disponibilidad.periodo.Periodo,
    entrada.datosActualizados
  );
  return obtenerRenovacion(idRenovacion, usuario);
}

export async function actualizarRenovacion(id, usuario, entrada) {
  await obtenerRenovacion(id, usuario);
  await datos.actualizarRenovacion(id, entrada.datosActualizados, entrada.enviar === true);
  return obtenerRenovacion(id, usuario);
}

export async function agregarDocumentoRenovacion(id, usuario, entrada) {
  await obtenerRenovacion(id, usuario);
  if (!entrada.archivo) throw errorValidacion('Debe adjuntar un archivo.');
  const idArchivo = await guardarArchivo(entrada.archivo);
  await datos.agregarDocumentoRenovacion(id, idArchivo, entrada.idTipoDocumento);
  return obtenerRenovacion(id, usuario);
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

