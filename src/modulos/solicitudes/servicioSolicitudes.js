import { errorValidacion, errorNoEncontrado, errorProhibido, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosSolicitudes.js';
import * as datosConvocatorias from '../convocatorias/accesoDatosConvocatorias.js';
import { guardarArchivo, obtenerArchivo, eliminarArchivoLogico } from '../../servicios-compartidos/servicioArchivos.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';

function esPropietarioOAutorizado(solicitud, usuarioActual) {
  if (solicitud.IdUsuario === usuarioActual.idUsuario) return true;
  return usuarioActual.permisos?.includes('EXPEDIENTE_LISTAR');
}

export async function obtenerSolicitud(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (!esPropietarioOAutorizado(solicitud, usuarioActual)) throw errorProhibido();

  const datosCompletos = await datos.obtenerDatosCompletos(idSolicitud);
  return { ...solicitud, ...datosCompletos };
}

async function obtenerSolicitudPropiaEditable(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (solicitud.IdUsuario !== usuarioActual.idUsuario) throw errorProhibido();
  if (solicitud.Estado !== 'BORRADOR') {
    throw errorConflicto('Solo se puede editar una solicitud en estado BORRADOR.');
  }
  return solicitud;
}

function obtenerEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  const dia = hoy.getDate() - nacimiento.getDate();
  if (mes < 0 || (mes === 0 && dia < 0)) edad -= 1;
  return edad;
}

function obtenerPeriodoActual(fecha = new Date()) {
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();
  const cuatrimestre = mes <= 4 ? 'I' : mes <= 8 ? 'II' : 'III';
  return `${cuatrimestre} Cuatrimestre ${anio}`;
}

const CARRERAS_PERMITIDAS = new Set([
  'Dirección y Administración de Empresas',
  'Electrónica',
  'Investigación Criminal',
  'Mecánica Dental',
  'Secretariado Ejecutivo',
  'Tecnologías de Información',
  'Turismo',
  'Big Data',
  'Gestión de Calidad',
  'Ciberseguridad'
]);

const CONDICIONES_ACADEMICAS = new Set([
  'Regular',
  'En buen estado',
  'En riesgo académico',
  'En prueba',
  'Suspendido'
]);

const TIPOS_VIVIENDA = new Set([
  'Propia',
  'Alquilada',
  'Prestada',
  'Familiar',
  'Cedida',
  'Residencial',
  'Otro'
]);

const SITUACIONES_LABORALES = new Set([
  'Empleado(a)',
  'Desempleado(a)',
  'Independiente',
  'Pensionado(a)',
  'Estudiante',
  'Trabajo temporal',
  'Otro'
]);

export async function crearSolicitud(idUsuario, idConvocatoria) {
  const convocatoria = await datosConvocatorias.obtenerConvocatoriaPorId(idConvocatoria);
  if (!convocatoria || convocatoria.Estado !== 'PUBLICADA') {
    throw errorValidacion('La convocatoria no está disponible para recibir solicitudes.');
  }

  const etapaRecepcion = await datosConvocatorias.obtenerEtapaAbierta(idConvocatoria, 'RECEPCION');
  if (!etapaRecepcion) {
    throw errorConflicto('La etapa de recepción de esta convocatoria no está abierta.');
  }

  const existente = await datos.obtenerSolicitudActivaUsuarioConvocatoria(idUsuario, idConvocatoria);
  if (existente) {
    throw errorConflicto('Ya existe una solicitud para esta convocatoria.');
  }

  const idSolicitud = await datos.crearSolicitud(idUsuario, idConvocatoria);
  return obtenerSolicitud(idSolicitud, { idUsuario, permisos: [] });
}

export async function listarSolicitudesUsuario(idUsuario) {
  return datos.listarSolicitudesUsuario(idUsuario);
}

export async function guardarDatosPersonales(idSolicitud, usuarioActual, datosEntrada) {
  await obtenerSolicitudPropiaEditable(idSolicitud, usuarioActual);
  const errores = [];
  if (!/^\d{9}$/.test(String(datosEntrada.identificacion || ''))) {
    errores.push({ campo: 'identificacion', mensaje: 'La identificación debe contener exactamente 9 dígitos numéricos.' });
  }
  if (!datosEntrada.fechaNacimiento) errores.push({ campo: 'fechaNacimiento', mensaje: 'La fecha de nacimiento es obligatoria.' });
  else if ((obtenerEdad(datosEntrada.fechaNacimiento) ?? -1) <= 18) {
    errores.push({ campo: 'fechaNacimiento', mensaje: 'Debe ser mayor de 18 años.' });
  }
  if (!/^\d{8}$/.test(String(datosEntrada.telefono || ''))) {
    errores.push({ campo: 'telefono', mensaje: 'El teléfono debe contener exactamente 8 dígitos numéricos.' });
  }
  if (!datosEntrada.direccion?.trim()) errores.push({ campo: 'direccion', mensaje: 'La dirección es obligatoria.' });
  if (datosEntrada.telefonoEmergencia && !/^\d{8}$/.test(String(datosEntrada.telefonoEmergencia || ''))) {
    errores.push({ campo: 'telefonoEmergencia', mensaje: 'El teléfono de emergencia debe contener exactamente 8 dígitos numéricos.' });
  }
  if (errores.length > 0) throw errorValidacion('Revise los datos personales.', errores);

  await datos.guardarDatosPersonales(idSolicitud, datosEntrada);
  await actualizarProgresoSolicitud(idSolicitud);
  return obtenerSolicitud(idSolicitud, usuarioActual);
}

export async function guardarDatosAcademicos(idSolicitud, usuarioActual, datosEntrada) {
  await obtenerSolicitudPropiaEditable(idSolicitud, usuarioActual);
  const errores = [];
  if (!datosEntrada.numeroEstudiante?.trim()) errores.push({ campo: 'numeroEstudiante', mensaje: 'El número de estudiante es obligatorio.' });
  if (!CARRERAS_PERMITIDAS.has(String(datosEntrada.carrera || ''))) {
    errores.push({ campo: 'carrera', mensaje: 'La carrera seleccionada no es válida.' });
  }
  if (!CONDICIONES_ACADEMICAS.has(String(datosEntrada.condicionAcademica || ''))) {
    errores.push({ campo: 'condicionAcademica', mensaje: 'La condición académica seleccionada no es válida.' });
  }
  if (datosEntrada.promedio === undefined || Number.isNaN(Number(datosEntrada.promedio)) || Number(datosEntrada.promedio) < 0 || Number(datosEntrada.promedio) > 100) {
    errores.push({ campo: 'promedio', mensaje: 'El promedio debe estar entre 0 y 100.' });
  }
  if (!Number.isInteger(Number(datosEntrada.creditosMatriculados)) || Number(datosEntrada.creditosMatriculados) <= 0) {
    errores.push({ campo: 'creditosMatriculados', mensaje: 'Los créditos matriculados deben ser un número entero positivo.' });
  }
  if (errores.length > 0) throw errorValidacion('Revise los datos académicos.', errores);

  await datos.guardarDatosAcademicos(idSolicitud, {
    ...datosEntrada,
    nivelAcademico: obtenerPeriodoActual()
  });
  await actualizarProgresoSolicitud(idSolicitud);
  return obtenerSolicitud(idSolicitud, usuarioActual);
}

export async function guardarDatosSocioeconomicos(idSolicitud, usuarioActual, datosEntrada) {
  await obtenerSolicitudPropiaEditable(idSolicitud, usuarioActual);
  const errores = [];
  if (!TIPOS_VIVIENDA.has(String(datosEntrada.tipoVivienda || ''))) {
    errores.push({ campo: 'tipoVivienda', mensaje: 'El tipo de vivienda seleccionado no es válido.' });
  }
  if (!Number.isInteger(Number(datosEntrada.cantidadIntegrantes)) || Number(datosEntrada.cantidadIntegrantes) <= 0) {
    errores.push({ campo: 'cantidadIntegrantes', mensaje: 'La cantidad de integrantes debe ser un entero positivo.' });
  }
  if (datosEntrada.ingresoMensual === undefined || Number.isNaN(Number(datosEntrada.ingresoMensual)) || Number(datosEntrada.ingresoMensual) <= 0) {
    errores.push({ campo: 'ingresoMensual', mensaje: 'El ingreso mensual debe ser un número positivo.' });
  }
  if (datosEntrada.gastoMensual === undefined || Number.isNaN(Number(datosEntrada.gastoMensual)) || Number(datosEntrada.gastoMensual) <= 0) {
    errores.push({ campo: 'gastoMensual', mensaje: 'Los gastos mensuales deben ser un número positivo.' });
  }
  if (!SITUACIONES_LABORALES.has(String(datosEntrada.situacionLaboral || ''))) {
    errores.push({ campo: 'situacionLaboral', mensaje: 'La situación laboral seleccionada no es válida.' });
  }
  if (errores.length > 0) throw errorValidacion('Revise los datos socioeconómicos.', errores);

  await datos.guardarDatosSocioeconomicos(idSolicitud, datosEntrada);
  await actualizarProgresoSolicitud(idSolicitud);
  return obtenerSolicitud(idSolicitud, usuarioActual);
}

async function actualizarProgresoSolicitud(idSolicitud) {
  const { datosPersonales, datosAcademicos, datosSocioeconomicos } = await datos.obtenerDatosCompletos(idSolicitud);
  const documentos = await datos.listarDocumentos(idSolicitud);
  const secciones = [Boolean(datosPersonales), Boolean(datosAcademicos), Boolean(datosSocioeconomicos), documentos.length > 0];
  const progreso = Math.round((secciones.filter(Boolean).length / secciones.length) * 100);
  await datos.actualizarProgreso(idSolicitud, progreso);
}

// --- Documentos ---

export async function listarDocumentos(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (!esPropietarioOAutorizado(solicitud, usuarioActual)) throw errorProhibido();
  return datos.listarDocumentos(idSolicitud);
}

export async function agregarDocumento(idSolicitud, usuarioActual, { idRequisito, idTipoDocumento, nombreOriginal, tipoMime, contenido }) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (solicitud.IdUsuario !== usuarioActual.idUsuario) throw errorProhibido();
  if (!['BORRADOR', 'PENDIENTE_SUBSANACION'].includes(solicitud.Estado)) {
    throw errorConflicto('Solo se pueden cargar documentos mientras la solicitud está en borrador o en subsanación.');
  }
  if (!contenido || contenido.length === 0) {
    throw errorValidacion('Debe adjuntar un archivo.');
  }

  const idArchivo = await guardarArchivo({ nombreOriginal, tipoMime, contenido });
  const idDocumento = await datos.agregarDocumento({ idSolicitud, idRequisito, idTipoDocumento, idArchivo });
  await actualizarProgresoSolicitud(idSolicitud);
  return { idDocumentoSolicitud: idDocumento };
}

export async function eliminarDocumento(idSolicitud, idDocumento, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (solicitud.IdUsuario !== usuarioActual.idUsuario) throw errorProhibido();

  const documento = await datos.obtenerDocumentoPorId(idDocumento);
  if (!documento || documento.IdSolicitud !== idSolicitud) throw errorNoEncontrado('El documento no existe.');

  const puedeEliminar = solicitud.Estado === 'BORRADOR' ||
    (solicitud.Estado === 'PENDIENTE_SUBSANACION' && documento.Estado === 'REQUIERE_SUBSANACION');
  if (!puedeEliminar) {
    throw errorConflicto('El documento no puede eliminarse en el estado actual de la solicitud.');
  }

  await datos.eliminarDocumentoLogico(idDocumento);
  await eliminarArchivoLogico(documento.IdArchivo);
  await actualizarProgresoSolicitud(idSolicitud);
}

export async function obtenerArchivoDocumento(idSolicitud, idDocumento, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (!esPropietarioOAutorizado(solicitud, usuarioActual)) throw errorProhibido();

  const documento = await datos.obtenerDocumentoPorId(idDocumento);
  if (!documento || documento.IdSolicitud !== idSolicitud) throw errorNoEncontrado('El documento no existe.');

  return obtenerArchivo(documento.IdArchivo);
}

// --- Validacion y envio ---

export async function validarSolicitud(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (!esPropietarioOAutorizado(solicitud, usuarioActual)) throw errorProhibido();

  const { datosPersonales, datosAcademicos, datosSocioeconomicos } = await datos.obtenerDatosCompletos(idSolicitud);
  const convocatoria = await datosConvocatorias.obtenerConvocatoriaPorId(solicitud.IdConvocatoria);
  const documentos = await datos.listarDocumentos(idSolicitud);

  const requisitosObligatorios = convocatoria.requisitos.filter((requisito) => requisito.Obligatorio);
  const documentosFaltantes = requisitosObligatorios
    .filter((requisito) => !documentos.some((documento) => documento.IdRequisito === requisito.IdRequisito))
    .map((requisito) => requisito.Nombre);

  const secciones = {
    datosPersonales: Boolean(datosPersonales),
    datosAcademicos: Boolean(datosAcademicos),
    datosSocioeconomicos: Boolean(datosSocioeconomicos)
  };

  const completa = Object.values(secciones).every(Boolean) && documentosFaltantes.length === 0;

  return { completa, secciones, documentosFaltantes, estadoSolicitud: solicitud.Estado };
}

export async function enviarSolicitud(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (solicitud.IdUsuario !== usuarioActual.idUsuario) throw errorProhibido();
  if (solicitud.Estado !== 'BORRADOR') {
    throw errorConflicto('La solicitud ya fue enviada.');
  }

  const etapaRecepcion = await datosConvocatorias.obtenerEtapaAbierta(solicitud.IdConvocatoria, 'RECEPCION');
  if (!etapaRecepcion) {
    throw errorConflicto('La etapa de recepción ya no está abierta.');
  }

  const validacion = await validarSolicitud(idSolicitud, usuarioActual);
  if (!validacion.completa) {
    throw errorValidacion('La solicitud está incompleta.', [
      ...Object.entries(validacion.secciones)
        .filter(([, completa]) => !completa)
        .map(([campo]) => ({ campo, mensaje: 'Sección incompleta.' })),
      ...validacion.documentosFaltantes.map((nombre) => ({ campo: 'documentos', mensaje: `Falta el documento: ${nombre}.` }))
    ]);
  }

  const idExpediente = await datos.enviarSolicitudTransaccion(idSolicitud);

  await crearNotificacion(null, {
    idUsuario: usuarioActual.idUsuario,
    tipo: 'SOLICITUD_ENVIADA',
    titulo: 'Solicitud enviada',
    mensaje: 'Su solicitud fue enviada correctamente y ahora se encuentra en revisión documental.',
    enlace: `/aspirante/solicitudes/${idSolicitud}/resultado`
  });

  await enviarCorreo({
    idUsuario: usuarioActual.idUsuario,
    correoDestino: usuarioActual.correo,
    asunto: 'Solicitud enviada - SGBE CUC',
    tipoMensaje: 'SOLICITUD_ENVIADA',
    contenidoHtml: '<p>Su solicitud de beca fue enviada correctamente y se generó un expediente para su revisión.</p>'
  });

  return { idExpediente };
}

export async function obtenerResultado(idSolicitud, usuarioActual) {
  const solicitud = await datos.obtenerSolicitudPorId(idSolicitud);
  if (!solicitud) throw errorNoEncontrado('La solicitud no existe.');
  if (solicitud.IdUsuario !== usuarioActual.idUsuario) throw errorProhibido();

  const resolucion = await datos.obtenerResolucionPublicada(idSolicitud);

  return {
    estadoSolicitud: solicitud.Estado,
    disponible: Boolean(resolucion),
    resolucion: resolucion
      ? {
          idResolucion: resolucion.IdResolucion,
          numeroResolucion: resolucion.NumeroResolucion,
          tipoResultado: resolucion.TipoResultado,
          porcentajeBeca: resolucion.PorcentajeBeca,
          motivo: resolucion.Motivo,
          fechaEmision: resolucion.FechaEmision
        }
      : null
  };
}
