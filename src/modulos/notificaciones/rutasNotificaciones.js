import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { listarNotificaciones, marcarNotificacionLeida } from '../../servicios-compartidos/servicioNotificaciones.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.get('/', asincrono(async (req, res) => {
  const notificaciones = await listarNotificaciones(req.usuario.idUsuario);
  enviarExito(res, { datos: notificaciones });
}));

rutas.patch('/:id/leida', asincrono(async (req, res) => {
  await marcarNotificacionLeida(req.usuario.idUsuario, Number(req.params.id));
  enviarExito(res, { mensaje: 'Notificación marcada como leída.' });
}));

export default rutas;
