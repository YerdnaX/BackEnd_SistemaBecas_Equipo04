import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioConfiguracion.js';

export const obtenerCorreo = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerEstadoCorreo() });
});

export const actualizarCorreo = asincrono(async (req, res) => {
  const datos = await servicio.actualizarNombreRemitente(req.body.nombreRemitente, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Configuración de correo actualizada.', datos });
});

export const reintentarCorreos = asincrono(async (req, res) => {
  const resultado = await servicio.reintentarCorreosFallidos(req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Reintento de correos ejecutado.', datos: resultado });
});

export const listarPlantillas = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarPlantillas() });
});

export const crearPlantilla = asincrono(async (req, res) => {
  const plantilla = await servicio.crearPlantilla(req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Plantilla creada.', datos: plantilla, estadoHttp: 201 });
});

export const actualizarPlantilla = asincrono(async (req, res) => {
  const plantilla = await servicio.actualizarPlantilla(req.params.codigo, req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Plantilla actualizada.', datos: plantilla });
});

export const previsualizarPlantilla = asincrono(async (req, res) => {
  const previa = await servicio.previsualizarPlantilla(req.params.codigo, req.body.variables || {});
  enviarExito(res, { datos: previa });
});

export const listarParametros = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarParametros() });
});

export const actualizarParametro = asincrono(async (req, res) => {
  const parametro = await servicio.actualizarParametro(req.params.clave, req.body.valor, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Parámetro actualizado.', datos: parametro });
});

export const listarTiposDocumento = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarTiposDocumento() });
});

export const crearTipoDocumento = asincrono(async (req, res) => {
  const tipos = await servicio.crearTipoDocumento(req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Tipo de documento creado.', datos: tipos, estadoHttp: 201 });
});

export const actualizarTipoDocumento = asincrono(async (req, res) => {
  const tipos = await servicio.actualizarTipoDocumento(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Tipo de documento actualizado.', datos: tipos });
});
