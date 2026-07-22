import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioAutenticacion.js';

function contextoPeticion(req) {
  return { ip: req.ip, agenteUsuario: req.headers['user-agent'] };
}

export const registro = asincrono(async (req, res) => {
  await servicio.registrarUsuario(req.body);
  enviarExito(res, {
    mensaje: 'Cuenta creada. Revise su correo para activarla.',
    estadoHttp: 201
  });
});

export const activar = asincrono(async (req, res) => {
  await servicio.activarCuenta(req.body.token);
  enviarExito(res, { mensaje: 'Cuenta activada correctamente.' });
});

export const reenviarActivacion = asincrono(async (req, res) => {
  await servicio.reenviarActivacion(req.body.correo);
  enviarExito(res, { mensaje: 'Si el correo está registrado, se envió un nuevo enlace de activación.' });
});

export const iniciarSesion = asincrono(async (req, res) => {
  const resultado = await servicio.iniciarSesion(req.body);
  enviarExito(res, {
    mensaje: 'Se envió un código de verificación a su correo.',
    datos: resultado
  });
});

export const verificarDosFactores = asincrono(async (req, res) => {
  const resultado = await servicio.verificarDosFactores(req.body, contextoPeticion(req));
  enviarExito(res, { mensaje: 'Sesión iniciada correctamente.', datos: resultado });
});

export const reenviarDosFactores = asincrono(async (req, res) => {
  await servicio.reenviarDosFactores(req.body.correo);
  enviarExito(res, { mensaje: 'Si corresponde, se envió un nuevo código.' });
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
