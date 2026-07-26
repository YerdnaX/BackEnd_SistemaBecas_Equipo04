import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioAutenticacion.js';

function contextoPeticion(req) {
  return { ip: req.ip, agenteUsuario: req.headers['user-agent'] };
}

export const registro = asincrono(async (req, res) => {
  const resultado = await servicio.registrarUsuario(req.body);
  enviarExito(res, {
    mensaje: 'Cuenta creada. Revise su correo e ingrese el código para activar la cuenta.',
    datos: resultado,
    estadoHttp: 201
  });
});

export const verificarRegistro = asincrono(async (req, res) => {
  await servicio.verificarCodigoRegistro(req.body);
  enviarExito(res, { mensaje: 'Cuenta activada correctamente. Ya puede iniciar sesión.' });
});

export const iniciarSesion = asincrono(async (req, res) => {
  const resultado = await servicio.iniciarSesion(req.body, contextoPeticion(req));
  const mensaje = resultado?.requiereDosFactores
    ? 'Se envió un código de verificación al correo registrado.'
    : 'Sesión iniciada correctamente.';
  enviarExito(res, { mensaje, datos: resultado });
});

export const verificarDosFactores = asincrono(async (req, res) => {
  const resultado = await servicio.verificarCodigoDosFactores(req.body, contextoPeticion(req));
  enviarExito(res, { mensaje: 'Sesión iniciada correctamente.', datos: resultado });
});

export const renovarSesion = asincrono(async (req, res) => {
  const resultado = await servicio.renovarSesion(req.body.refreshToken);
  enviarExito(res, { mensaje: 'Sesión renovada.', datos: resultado });
});

export const cerrarSesion = asincrono(async (req, res) => {
  await servicio.cerrarSesion(req.body.refreshToken);
  enviarExito(res, { mensaje: 'Sesión cerrada.' });
});

export const recuperarContrasena = asincrono(async (req, res) => {
  await servicio.recuperarContrasena(req.body.correo);
  enviarExito(res, { mensaje: 'Si el correo está registrado, se enviaron instrucciones de recuperación.' });
});

export const restablecerContrasena = asincrono(async (req, res) => {
  await servicio.restablecerContrasena(req.body);
  enviarExito(res, { mensaje: 'Contraseña actualizada. Ya puede iniciar sesión.' });
});
