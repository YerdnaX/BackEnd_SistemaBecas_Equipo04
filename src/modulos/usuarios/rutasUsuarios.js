import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { obtenerUsuarioActual } from '../autenticacion/servicioAutenticacion.js';

const rutas = Router();

rutas.get('/actual', requiereSesion, asincrono(async (req, res) => {
  const usuario = await obtenerUsuarioActual(req.usuario.idUsuario);
  enviarExito(res, { datos: usuario });
}));

export default rutas;
