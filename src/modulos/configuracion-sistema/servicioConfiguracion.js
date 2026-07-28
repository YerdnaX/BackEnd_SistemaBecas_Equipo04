import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosConfiguracion.js';
import { configuracion } from '../../configuracion/variablesEntorno.js';
import { invalidarCacheParametros } from '../../servicios-compartidos/servicioParametros.js';
import { renderizarPlantillaPreliminar } from '../../servicios-compartidos/servicioNotificacionesTransaccionales.js';
import { registrarAuditoria } from '../../servicios-compartidos/servicioAuditoria.js';
import { reintentarEnviosFallidos, enviarCorreoPrueba } from '../../servicios-compartidos/servicioCorreo.js';

// --- Correo ---
// Los secretos (host, usuario, contrasena SMTP) viven unicamente en
// variables de entorno del backend (ver seccion 3.6 de agend.md) y
// nunca se exponen aqui. Este endpoint solo informa si estan
// configurados y permite editar el nombre visible del remitente, que
// no es sensible y se guarda en ConfiguracionesSistema.
export async function obtenerEstadoCorreo() {
  const smtpConfigurado = Boolean(configuracion.smtp.host);
  const googleConfigurado = Boolean(
    configuracion.googleCorreo.clientId
    && configuracion.googleCorreo.clientSecret
    && configuracion.googleCorreo.refreshToken
    && configuracion.googleCorreo.usuario
  );

  return {
    smtpConfigurado,
    googleConfigurado,
    correoConfigurado: smtpConfigurado || googleConfigurado,
    proveedorCorreo: googleConfigurado ? 'GOOGLE_API' : smtpConfigurado ? 'SMTP' : 'NINGUNO',
    remitente: configuracion.smtp.remitente,
    nombreRemitente: await datos.obtenerParametroPorClave('CORREO_REMITENTE_NOMBRE').then((p) => p?.Valor || 'SGBE CUC')
  };
}

export async function actualizarNombreRemitente(nombreRemitente, idUsuario) {
  if (!nombreRemitente?.trim()) throw errorValidacion('Debe indicar un nombre de remitente.');
  await datos.actualizarParametro('CORREO_REMITENTE_NOMBRE', nombreRemitente.trim());
  invalidarCacheParametros();
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'CORREO_REMITENTE_ACTUALIZADO', detalle: nombreRemitente });
  return obtenerEstadoCorreo();
}

// --- Plantillas ---

export async function listarPlantillas() {
  return datos.listarPlantillas();
}

export async function crearPlantilla({ codigo, asunto, contenido }, idUsuario) {
  if (!codigo?.trim() || !asunto?.trim() || !contenido?.trim()) {
    throw errorValidacion('Debe indicar código, asunto y contenido de la plantilla.');
  }
  const existente = await datos.obtenerPlantillaPorCodigo(codigo);
  if (existente) throw errorConflicto('Ya existe una plantilla con ese código.');
  await datos.crearPlantilla({ codigo, asunto, contenido });
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'PLANTILLA_CREADA', entidad: 'PlantillaMensaje', detalle: codigo });
  return datos.obtenerPlantillaPorCodigo(codigo);
}

export async function actualizarPlantilla(codigo, { asunto, contenido, activo }, idUsuario) {
  const existente = await datos.obtenerPlantillaPorCodigo(codigo);
  if (!existente) throw errorNoEncontrado('La plantilla no existe.');
  if (!asunto?.trim() || !contenido?.trim()) throw errorValidacion('Debe indicar asunto y contenido.');

  await datos.actualizarPlantilla(codigo, { asunto, contenido, activo: activo ?? existente.Activo });
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'PLANTILLA_ACTUALIZADA', entidad: 'PlantillaMensaje', detalle: codigo });
  return datos.obtenerPlantillaPorCodigo(codigo);
}

export async function previsualizarPlantilla(codigo, variables = {}) {
  const plantilla = await datos.obtenerPlantillaPorCodigo(codigo);
  if (!plantilla) throw errorNoEncontrado('La plantilla no existe.');
  return renderizarPlantillaPreliminar(plantilla, variables);
}

// --- Parametros ---

export async function listarParametros() {
  return datos.listarParametros();
}

export async function actualizarParametro(clave, valor, idUsuario) {
  const existente = await datos.obtenerParametroPorClave(clave);
  if (!existente) throw errorNoEncontrado('El parámetro no existe.');
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw errorValidacion('Debe indicar un valor.');
  }
  if (existente.TipoDato === 'NUMERO' && Number.isNaN(Number(valor))) {
    throw errorValidacion('El valor debe ser numérico.');
  }

  await datos.actualizarParametro(clave, String(valor));
  invalidarCacheParametros();
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'PARAMETRO_ACTUALIZADO', entidad: 'ConfiguracionSistema', detalle: `${clave}=${valor}` });
  return datos.obtenerParametroPorClave(clave);
}

export async function enviarCorreoDePrueba(correoDestino, idUsuario) {
  if (!correoDestino?.trim()) throw errorValidacion('Debe indicar un correo de destino para la prueba.');

  const resultado = await enviarCorreoPrueba(correoDestino.trim());

  await registrarAuditoria({
    idUsuario,
    modulo: 'CONFIGURACION',
    accion: 'CORREO_PRUEBA_ENVIADO',
    detalle: `${correoDestino.trim()} -> ${resultado.enviado ? 'ENVIADO' : 'FALLIDO'}`
  });

  return resultado;
}

export async function reintentarCorreosFallidos(idUsuario) {
  const maximo = await datos.obtenerParametroPorClave('NOTIFICACION_REINTENTOS_MAXIMOS');
  const resultado = await reintentarEnviosFallidos(maximo ? Number(maximo.Valor) : 3);
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'REINTENTO_CORREOS_EJECUTADO', detalle: JSON.stringify(resultado) });
  return resultado;
}

// --- Catalogo: tipos de documento ---

export async function listarTiposDocumento() {
  return datos.listarTiposDocumento();
}

export async function crearTipoDocumento(datosTipo, idUsuario) {
  if (!datosTipo.codigo?.trim() || !datosTipo.nombre?.trim()) {
    throw errorValidacion('Debe indicar código y nombre del tipo de documento.');
  }
  await datos.crearTipoDocumento(datosTipo);
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'CATALOGO_TIPO_DOCUMENTO_CREADO', detalle: datosTipo.codigo });
  return datos.listarTiposDocumento();
}

export async function actualizarTipoDocumento(idTipoDocumento, datosTipo, idUsuario) {
  if (!datosTipo.nombre?.trim()) throw errorValidacion('Debe indicar el nombre del tipo de documento.');
  await datos.actualizarTipoDocumento(idTipoDocumento, datosTipo);
  await registrarAuditoria({ idUsuario, modulo: 'CONFIGURACION', accion: 'CATALOGO_TIPO_DOCUMENTO_ACTUALIZADO', idEntidad: idTipoDocumento });
  return datos.listarTiposDocumento();
}
