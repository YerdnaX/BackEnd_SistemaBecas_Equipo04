import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioAsistente.js';

export const iniciar = asincrono(async (req, res) => {
  const datos = await servicio.iniciarConversacion();
  enviarExito(res, { mensaje: 'Conversación iniciada.', datos, estadoHttp: 201 });
});

export const enviarMensaje = asincrono(async (req, res) => {
  const datos = await servicio.enviarMensaje(req.params.id, req.body.mensaje);
  enviarExito(res, { datos });
});
