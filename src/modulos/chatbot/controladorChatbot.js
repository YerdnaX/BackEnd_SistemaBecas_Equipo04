import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioChatbot.js';

export const consultar = asincrono(async (req, res) => {
  const respuesta = await servicio.consultarPublico(req.body.pregunta);
  enviarExito(res, { datos: respuesta });
});

export const categorias = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarCategorias() });
});

export const listar = asincrono(async (req, res) => {
  const { categoria } = req.query;
  enviarExito(res, { datos: await servicio.listarEntradas({ categoria }, req.usuario) });
});

export const crear = asincrono(async (req, res) => {
  const entrada = await servicio.crearEntrada(req.body, req.usuario);
  enviarExito(res, { mensaje: 'Entrada creada.', datos: entrada, estadoHttp: 201 });
});

export const actualizar = asincrono(async (req, res) => {
  const entrada = await servicio.actualizarEntrada(Number(req.params.id), req.body, req.usuario);
  enviarExito(res, { mensaje: 'Entrada actualizada.', datos: entrada });
});

export const eliminar = asincrono(async (req, res) => {
  const resultado = await servicio.eliminarEntrada(Number(req.params.id), req.usuario);
  enviarExito(res, { mensaje: 'Entrada desactivada.', datos: resultado });
});
