import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { listarSolicitudesUsuario } from '../solicitudes/servicioSolicitudes.js';
import { listarNotificaciones } from '../../servicios-compartidos/servicioNotificaciones.js';

const rutas = Router();

rutas.get('/panel', requiereSesion, asincrono(async (req, res) => {
  const [solicitudes, notificaciones] = await Promise.all([
    listarSolicitudesUsuario(req.usuario.idUsuario),
    listarNotificaciones(req.usuario.idUsuario)
  ]);
  enviarExito(res, {
    datos: {
      solicitudes,
      notificaciones: notificaciones.slice(0, 10),
      notificacionesSinLeer: notificaciones.filter((n) => !n.Leida).length
    }
  });
}));

export default rutas;
