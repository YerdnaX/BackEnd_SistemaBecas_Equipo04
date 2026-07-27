import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { obtenerUsuarioActual } from '../autenticacion/servicioAutenticacion.js';
import * as servicioUsuarios from './servicioUsuarios.js';

const rutas = Router();

rutas.get('/actual', requiereSesion, asincrono(async (req, res) => {
  const usuario = await obtenerUsuarioActual(req.usuario.idUsuario);
  enviarExito(res, { datos: usuario });
}));

rutas.put('/actual/contrasena', requiereSesion, asincrono(async (req, res) => {
  await servicioUsuarios.cambiarContrasena(req.usuario.idUsuario, req.body);
  enviarExito(res, { mensaje: 'Contraseña actualizada correctamente. Inicie sesión nuevamente.' });
}));

rutas.post('/actual/correo/solicitud', requiereSesion, asincrono(async (req, res) => {
  const resultado = await servicioUsuarios.solicitarCambioCorreo(req.usuario.idUsuario, req.body);
  enviarExito(res, {
    mensaje: 'Se envió un código de verificación al nuevo correo.',
    datos: resultado
  });
}));

rutas.post('/actual/correo/verificar', requiereSesion, asincrono(async (req, res) => {
  const resultado = await servicioUsuarios.verificarCambioCorreo(req.usuario.idUsuario, req.body);
  enviarExito(res, { mensaje: 'Correo actualizado correctamente.', datos: resultado });
}));

export default rutas;
