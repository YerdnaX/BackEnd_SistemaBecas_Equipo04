import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { configuracion } from '../../configuracion/variablesEntorno.js';
import { errorValidacion, errorNoAutorizado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import { correoEsValido, contrasenaEsSegura } from '../../utilidades/validaciones.js';
import { generarTokenAleatorio, hashearValor, generarCodigoOtp } from '../../utilidades/tokens.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';
import * as datosAuth from './accesoDatosAutenticacion.js';

const RONDAS_BCRYPT = 10;

function sumarHoras(horas) {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

function sumarMinutos(minutos) {
  return new Date(Date.now() + minutos * 60 * 1000);
}

function ocultarCorreo(correo) {
  const [usuario, dominio] = (correo || '').split('@');
  if (!usuario || !dominio) return correo || '';
  const inicio = usuario.slice(0, 2);
  return `${inicio}${'*'.repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

function obtenerTipoUsuario(roles = []) {
  if (roles.includes('ADMINISTRADOR')) return 'Administrador';
  if (roles.includes('COORDINADOR_BECAS')) return 'Coordinador de becas';
  if (roles.includes('TRABAJADORA_SOCIAL')) return 'Trabajadora social';
  if (roles.includes('COMITE_BECAS')) return 'Comité de becas';
  if (roles.includes('BECADO')) return 'Becado';
  if (roles.includes('ASPIRANTE')) return 'Aspirante';
  return 'Usuario';
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
    usuario: {
      idUsuario: usuario.IdUsuario,
      correo: usuario.Correo,
      nombre: usuario.Nombre,
      tipoUsuario: obtenerTipoUsuario(roles),
      roles,
      permisos
    }
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

  await datosAuth.invalidarTokensActivacionUsuario(idUsuario);
  const codigoActivacion = generarCodigoOtp();
  await datosAuth.crearTokenActivacion(
    idUsuario,
    hashearValor(codigoActivacion),
    sumarHoras(configuracion.autenticacion.tokenActivacionHoras)
  );

  await enviarCorreo({
    idUsuario,
    correoDestino: correo,
    asunto: 'Código de activación de cuenta - SGBE CUC',
    tipoMensaje: 'REGISTRO_ACTIVACION',
    contenidoHtml: `<p>Su código de activación es:</p><p style="font-size: 24px;"><strong>${codigoActivacion}</strong></p><p>Este código vence en ${configuracion.autenticacion.tokenActivacionHoras} horas.</p>`
  });

  return {
    idUsuario,
    requiereVerificacion: true,
    correo: ocultarCorreo(correo),
    expiraEnHoras: configuracion.autenticacion.tokenActivacionHoras
  };
}

export async function verificarCodigoRegistro({ correo, codigo }) {
  if (!correoEsValido(correo)) {
    throw errorValidacion('El correo no es válido.', [{ campo: 'correo', mensaje: 'El correo no es válido.' }]);
  }
  if (!codigo || !/^\d{6}$/.test(String(codigo))) {
    throw errorValidacion('El código debe tener 6 dígitos.', [{ campo: 'codigo', mensaje: 'El código debe tener 6 dígitos.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (!usuario) {
    throw errorNoAutorizado('No fue posible validar el código de activación.');
  }
  if (usuario.Estado === 'ACTIVO') {
    return { activada: true };
  }
  if (usuario.Estado !== 'PENDIENTE_ACTIVACION') {
    throw errorConflicto('La cuenta no puede activarse en su estado actual.');
  }

  const token = await datosAuth.obtenerTokenActivacionVigente(hashearValor(String(codigo)), usuario.IdUsuario);
  if (!token) {
    throw errorNoAutorizado('El código de activación es incorrecto o venció.');
  }

  await datosAuth.marcarTokenActivacionUsado(token.IdTokenActivacion);
  await datosAuth.activarUsuario(usuario.IdUsuario);
  return { activada: true };
}

export async function iniciarSesion({ correo, contrasena }, contexto) {
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

  if (!usuario.RequiereDosFactores) {
    return generarTokensSesion(usuario, contexto);
  }

  await datosAuth.invalidarRetosDosFactoresUsuario(usuario.IdUsuario);

  const codigoOtp = generarCodigoOtp();
  const idReto = await datosAuth.crearRetoDosFactores({
    idUsuario: usuario.IdUsuario,
    codigoHash: hashearValor(codigoOtp),
    fechaVencimiento: sumarMinutos(configuracion.autenticacion.otpDuracionMinutos)
  });

  await enviarCorreo({
    idUsuario: usuario.IdUsuario,
    correoDestino: usuario.Correo,
    asunto: 'Código de verificación de inicio de sesión - SGBE CUC',
    tipoMensaje: 'INICIO_SESION_DOS_FACTORES',
    contenidoHtml: `<p>Su código de verificación es:</p><p style="font-size: 24px;"><strong>${codigoOtp}</strong></p><p>Este código vence en ${configuracion.autenticacion.otpDuracionMinutos} minutos.</p>`
  });

  return {
    requiereDosFactores: true,
    retoId: idReto,
    correo: ocultarCorreo(usuario.Correo),
    expiraEnMinutos: configuracion.autenticacion.otpDuracionMinutos
  };

}

export async function verificarCodigoDosFactores({ retoId, correo, codigo }, contexto) {
  if (!retoId || !Number.isInteger(Number(retoId))) {
    throw errorValidacion('El reto de verificación no es válido.', [{ campo: 'retoId', mensaje: 'El reto no es válido.' }]);
  }
  if (!correoEsValido(correo)) {
    throw errorValidacion('El correo no es válido.', [{ campo: 'correo', mensaje: 'El correo no es válido.' }]);
  }
  if (!codigo || !/^\d{6}$/.test(String(codigo))) {
    throw errorValidacion('El código debe tener 6 dígitos.', [{ campo: 'codigo', mensaje: 'El código debe tener 6 dígitos.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (!usuario) throw errorNoAutorizado('No fue posible validar el código de seguridad.');

  const reto = await datosAuth.obtenerRetoDosFactoresVigente(Number(retoId));
  if (!reto || reto.IdUsuario !== usuario.IdUsuario) {
    throw errorNoAutorizado('No fue posible validar el código de seguridad.');
  }

  if (reto.Intentos >= configuracion.autenticacion.otpIntentosMaximos) {
    await datosAuth.marcarRetoDosFactoresUsado(reto.IdReto);
    throw errorConflicto('El código fue bloqueado por intentos excedidos. Inicie sesión nuevamente.');
  }

  if (hashearValor(String(codigo)) !== reto.CodigoHash) {
    await datosAuth.incrementarIntentosRetoDosFactores(reto.IdReto);
    throw errorNoAutorizado('El código de verificación es incorrecto.');
  }

  if (usuario.Estado !== 'ACTIVO') {
    throw errorNoAutorizado('La cuenta no está disponible para iniciar sesión.');
  }

  await datosAuth.marcarRetoDosFactoresUsado(reto.IdReto);
  return generarTokensSesion(usuario, contexto);

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
    await datosAuth.invalidarTokensRecuperacionUsuario(usuario.IdUsuario);

    const codigoRecuperacion = generarCodigoOtp();
    const tokenHash = hashearValor(codigoRecuperacion);
    await datosAuth.crearTokenRecuperacion(
      usuario.IdUsuario,
      tokenHash,
      sumarHoras(configuracion.autenticacion.tokenRecuperacionHoras)
    );

    await enviarCorreo({
      idUsuario: usuario.IdUsuario,
      correoDestino: usuario.Correo,
      asunto: 'Recuperación de contraseña - SGBE CUC',
      tipoMensaje: 'RECUPERACION_CONTRASENA',
      contenidoHtml: `<p>Su código de recuperación es:</p><p style="font-size: 24px;"><strong>${codigoRecuperacion}</strong></p><p>Este código vence en ${configuracion.autenticacion.tokenRecuperacionHoras} horas.</p><p>Use este código en la pantalla de recuperación de contraseña.</p>`
    });
  }
  // Respuesta identica exista o no la cuenta.
}

export async function verificarCodigoRecuperacion({ correo, codigo }) {
  if (!correoEsValido(correo)) {
    throw errorValidacion('El correo no es válido.', [{ campo: 'correo', mensaje: 'El correo no es válido.' }]);
  }
  if (!codigo || !/^\d{6}$/.test(String(codigo))) {
    throw errorValidacion('El código debe tener 6 dígitos.', [{ campo: 'codigo', mensaje: 'El código debe tener 6 dígitos.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (!usuario || usuario.Estado === 'INACTIVO') {
    throw errorNoAutorizado('No fue posible validar el código de recuperación.');
  }

  const registro = await datosAuth.obtenerTokenRecuperacionVigentePorUsuario(
    hashearValor(String(codigo)),
    usuario.IdUsuario
  );
  if (!registro) {
    throw errorNoAutorizado('El código de recuperación es incorrecto o venció.');
  }

  return {
    validado: true,
    correo: ocultarCorreo(usuario.Correo),
    expiraEnHoras: configuracion.autenticacion.tokenRecuperacionHoras
  };
}

export async function restablecerContrasena({ correo, codigo, contrasena, confirmacion }) {
  if (!correoEsValido(correo)) {
    throw errorValidacion('El correo no es válido.', [{ campo: 'correo', mensaje: 'El correo no es válido.' }]);
  }
  if (!codigo || !/^\d{6}$/.test(String(codigo))) {
    throw errorValidacion('El código debe tener 6 dígitos.', [{ campo: 'codigo', mensaje: 'El código debe tener 6 dígitos.' }]);
  }
  if (!contrasenaEsSegura(contrasena)) {
    throw errorValidacion('La contraseña no cumple los requisitos de seguridad.', [
      { campo: 'contrasena', mensaje: 'Debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.' }
    ]);
  }
  if (contrasena !== confirmacion) {
    throw errorValidacion('Las contraseñas no coinciden.', [{ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorCorreo(correo);
  if (!usuario || usuario.Estado === 'INACTIVO') {
    throw errorNoAutorizado('No fue posible validar el código de recuperación.');
  }

  const registro = await datosAuth.obtenerTokenRecuperacionVigentePorUsuario(
    hashearValor(String(codigo)),
    usuario.IdUsuario
  );
  if (!registro) throw errorValidacion('El código de recuperación no es válido o venció.');

  const contrasenaHash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
  await datosAuth.actualizarContrasena(usuario.IdUsuario, contrasenaHash);
  await datosAuth.marcarTokenRecuperacionUsado(registro.IdTokenRecuperacion);
  await datosAuth.revocarSesionesUsuario(usuario.IdUsuario);
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
    tipoUsuario: obtenerTipoUsuario(roles),
    roles,
    permisos
  };
}
