import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioCierre.js';

export const verificar = asincrono(async (req, res) => {
  const resultado = await servicio.verificarBloqueadores(Number(req.params.id));
  enviarExito(res, { datos: resultado });
});

export const cerrar = asincrono(async (req, res) => {
  const cierre = await servicio.cerrarExpediente(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Expediente cerrado correctamente.', datos: cierre });
});
