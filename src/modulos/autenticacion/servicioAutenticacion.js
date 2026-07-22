import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { configuracion } from '../../configuracion/variablesEntorno.js';
import { errorValidacion, errorNoAutorizado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import { correoEsValido, contrasenaEsSegura } from '../../utilidades/validaciones.js';
import { generarTokenAleatorio, generarCodigoOtp, hashearValor } from '../../utilidades/tokens.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';
import * as datosAuth from './accesoDatosAutenticacion.js';

const RONDAS_BCRYPT = 10;

function sumarHoras(horas) {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

function sumarMinutos(minutos) {
  return new Date(Date.now() + minutos * 60 * 1000);
}

async function generarTokensSesion(usuario, contexto) {
  const { roles, permisos } = await datosAuth.obtenerRolesYPermisos(usuario.IdUsuario);

  const tokenAcceso = jwt.sign(
    { idUsuario: usuario.IdUsuario, correo: usuario.Correo, roles, permisos },
    configuracion.jwt.secreto,
    { expiresIn: configuracion.jwt.duracion }
  );

  const refreshToken = generarTokenAleatorio();
  const refreshTokenHash = hashearValor(refreshToken);
  const diasRefresco = 7;
  await datosAuth.crearSesion({
    idUsuario: usuario.IdUsuario,
    refreshTokenHash,
    fechaVencimiento: new Date(Date.now() + diasRefresco * 24 * 60 * 60 * 1000),
    direccionIp: contexto?.ip,
    agenteUsuario: contexto?.agenteUsuario
  });

  return {
    tokenAcceso,
    refreshToken,
    usuario: { idUsuario: usuario.IdUsuario, correo: usuario.Correo, nombre: usuario.Nombre, roles, permisos }
  };
}

export async function registrarUsuario({ correo, contrasena, confirmacion, nombre, primerApellido, segundoApellido, aceptaTerminos }) {
  const errores = [];
  if (!nombre?.trim()) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
  if (!primerApellido?.trim()) errores.push({ campo: 'primerApellido', mensaje: 'El primer apellido es obligatorio.' });
  if (!correoEsValido(correo)) errores.push({ campo: 'correo', mensaje: 'El correo no es válido.' });
  if (!contrasenaEsSegura(contrasena)) {
    errores.push({ campo: 'contrasena', mensaje: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.' });
  }
  if (contrasena !== confirmacion) errores.push({ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden.' });
  if (!aceptaTerminos) errores.push({ campo: 'aceptaTerminos', mensaje: 'Debe aceptar los términos y condiciones.' });
  if (errores.length > 0) throw errorValidacion('Revise los datos del formulario.', errores);

  const existente = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (existente) throw errorValidacion('No fue posible completar el registro.', [{ campo: 'correo', mensaje: 'El correo ya está registrado.' }]);

  const contrasenaHash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
  const idUsuario = await datosAuth.crearUsuario({ correo, contrasenaHash, nombre, primerApellido, segundoApellido });

  await enviarTokenActivacion(idUsuario, correo);

  return { idUsuario };
}

async function enviarTokenActivacion(idUsuario, correo) {
  const token = generarTokenAleatorio();
  const tokenHash = hashearValor(token);
  await datosAuth.crearTokenActivacion(idUsuario, tokenHash, sumarHoras(configuracion.autenticacion.tokenActivacionHoras));

  const enlace = `${configuracion.urlFrontend}/activar-cuenta?token=${token}`;
  await enviarCorreo({
    idUsuario,
    correoDestino: correo,
    asunto: 'Activa tu cuenta - SGBE CUC',
    tipoMensaje: 'ACTIVACION_CUENTA',
    contenidoHtml: `<p>Para activar tu cuenta ingresa al siguiente enlace (vigente ${configuracion.autenticacion.tokenActivacionHoras} horas):</p><p><a href="${enlace}">${enlace}</a></p>`
  });
}

export async function activarCuenta(token) {
  if (!token) throw errorValidacion('El token de activación es obligatorio.');
  const tokenHash = hashearValor(token);
  const registro = await datosAuth.obtenerTokenActivacionVigente(tokenHash);
  if (!registro) throw errorValidacion('El enlace de activación no es válido o venció.');

  await datosAuth.activarUsuario(registro.IdUsuario);
  await datosAuth.marcarTokenActivacionUsado(registro.IdTokenActivacion);
}

export async function reenviarActivacion(correo) {
  const usuario = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (usuario && usuario.Estado === 'PENDIENTE_ACTIVACION') {
    await enviarTokenActivacion(usuario.IdUsuario, usuario.Correo);
  }
  // Respuesta identica exista o no la cuenta, para no revelar informacion sensible.
}

export async function iniciarSesion({ correo, contrasena }) {
  const usuario = correo ? await datosAuth.obtenerUsuarioPorCorreo(correo) : null;
  const contrasenaValida = usuario ? await bcrypt.compare(contrasena || '', usuario.ContrasenaHash) : false;

  if (!usuario || !contrasenaValida) {
    if (usuario) await datosAuth.incrementarIntentosFallidos(usuario.IdUsuario);
    throw errorNoAutorizado('Correo o contraseña incorrectos.');
  }

  if (usuario.Estado === 'PENDIENTE_ACTIVACION') {
    throw errorConflicto('La cuenta no ha sido activada. Revise su correo.');
  }
  if (usuario.Estado === 'BLOQUEADO') {
    throw errorConflicto('La cuenta está bloqueada. Contacte al administrador.');
  }
  if (usuario.Estado === 'INACTIVO') {
    throw errorConflicto('La cuenta está inactiva.');
  }

  await datosAuth.resetearIntentosFallidos(usuario.IdUsuario);
  await enviarCodigoDosFactores(usuario);

  return { correo: usuario.Correo };
}

async function enviarCodigoDosFactores(usuario) {
  const codigo = generarCodigoOtp();
  const codigoHash = hashearValor(codigo);
  await datosAuth.crearRetoDosFactores(usuario.IdUsuario, codigoHash, sumarMinutos(configuracion.autenticacion.otpDuracionMinutos));

  await enviarCorreo({
    idUsuario: usuario.IdUsuario,
    correoDestino: usuario.Correo,
    asunto: 'Código de verificación - SGBE CUC',
    tipoMensaje: 'VERIFICACION_2FA',
    contenidoHtml: `<p>Su código de verificación es <strong>${codigo}</strong>. Vence en ${configuracion.autenticacion.otpDuracionMinutos} minutos.</p>`
  });
}

export async function verificarDosFactores({ correo, codigo }, contexto) {
  const usuario = correo ? await datosAuth.obtenerUsuarioPorCorreo(correo) : null;
  if (!usuario) throw errorNoAutorizado('No fue posible verificar el código.');

  const reto = await datosAuth.obtenerRetoVigente(usuario.IdUsuario);
  if (!reto) throw errorConflicto('El código venció. Solicite uno nuevo.');

  if (reto.Intentos >= configuracion.autenticacion.otpIntentosMaximos) {
    throw errorConflicto('Se superó el número máximo de intentos. Solicite un nuevo código.');
  }

  const codigoHash = hashearValor(String(codigo || ''));
  if (codigoHash !== reto.CodigoHash) {
    await datosAuth.incrementarIntentoReto(reto.IdReto);
    throw errorNoAutorizado('El código ingresado no es correcto.');
  }

  await datosAuth.marcarRetoUsado(reto.IdReto);
  return generarTokensSesion(usuario, contexto);
}

export async function reenviarDosFactores(correo) {
  const usuario = correo ? await datosAuth.obtenerUsuarioPorCorreo(correo) : null;
  if (usuario && usuario.Estado === 'ACTIVO') {
    await enviarCodigoDosFactores(usuario);
  }
}

export async function renovarSesion(refreshToken) {
  if (!refreshToken) throw errorNoAutorizado('Sesión inválida.');
  const refreshTokenHash = hashearValor(refreshToken);
  const sesion = await datosAuth.obtenerSesionPorRefreshHash(refreshTokenHash);
  if (!sesion) throw errorNoAutorizado('La sesión expiró. Inicie sesión nuevamente.');

  const usuario = await datosAuth.obtenerUsuarioPorId(sesion.IdUsuario);
  if (!usuario || usuario.Estado !== 'ACTIVO') throw errorNoAutorizado('La sesión ya no es válida.');

  await datosAuth.revocarSesion(sesion.IdSesion);
  return generarTokensSesion(usuario, { ip: sesion.DireccionIp, agenteUsuario: sesion.AgenteUsuario });
}

export async function cerrarSesion(refreshToken) {
  if (!refreshToken) return;
  const refreshTokenHash = hashearValor(refreshToken);
  const sesion = await datosAuth.obtenerSesionPorRefreshHash(refreshTokenHash);
  if (sesion) await datosAuth.revocarSesion(sesion.IdSesion);
}

export async function recuperarContrasena(correo) {
  const usuario = correo ? await datosAuth.obtenerUsuarioPorCorreo(correo) : null;
  if (usuario && usuario.Estado !== 'INACTIVO') {
    const token = generarTokenAleatorio();
    const tokenHash = hashearValor(token);
    await datosAuth.crearTokenRecuperacion(usuario.IdUsuario, tokenHash, sumarHoras(configuracion.autenticacion.tokenRecuperacionHoras));

    const enlace = `${configuracion.urlFrontend}/restablecer-contrasena?token=${token}`;
    await enviarCorreo({
      idUsuario: usuario.IdUsuario,
      correoDestino: usuario.Correo,
      asunto: 'Recuperación de contraseña - SGBE CUC',
      tipoMensaje: 'RECUPERACION_CONTRASENA',
      contenidoHtml: `<p>Para restablecer su contraseña ingrese al siguiente enlace (vigente ${configuracion.autenticacion.tokenRecuperacionHoras} horas):</p><p><a href="${enlace}">${enlace}</a></p>`
    });
  }
  // Respuesta identica exista o no la cuenta.
}

export async function restablecerContrasena({ token, contrasena, confirmacion }) {
  if (!contrasenaEsSegura(contrasena)) {
    throw errorValidacion('La contraseña no cumple los requisitos de seguridad.', [
      { campo: 'contrasena', mensaje: 'Debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.' }
    ]);
  }
  if (contrasena !== confirmacion) {
    throw errorValidacion('Las contraseñas no coinciden.', [{ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden.' }]);
  }

  const tokenHash = hashearValor(token || '');
  const registro = await datosAuth.obtenerTokenRecuperacionVigente(tokenHash);
  if (!registro) throw errorValidacion('El enlace de recuperación no es válido o venció.');

  const contrasenaHash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
  await datosAuth.actualizarContrasena(registro.IdUsuario, contrasenaHash);
  await datosAuth.marcarTokenRecuperacionUsado(registro.IdTokenRecuperacion);
  await datosAuth.revocarSesionesUsuario(registro.IdUsuario);
}

export async function obtenerUsuarioActual(idUsuario) {
  const usuario = await datosAuth.obtenerUsuarioPorId(idUsuario);
  if (!usuario) throw errorNoAutorizado('Usuario no encontrado.');
  const { roles, permisos } = await datosAuth.obtenerRolesYPermisos(idUsuario);
  return {
    idUsuario: usuario.IdUsuario,
    correo: usuario.Correo,
    nombre: usuario.Nombre,
    primerApellido: usuario.PrimerApellido,
    segundoApellido: usuario.SegundoApellido,
    roles,
    permisos
  };
}
