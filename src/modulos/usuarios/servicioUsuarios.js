import bcrypt from 'bcryptjs';
import { errorConflicto, errorNoAutorizado, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { correoEsValido, contrasenaEsSegura } from '../../utilidades/validaciones.js';
import { generarCodigoOtp, hashearValor } from '../../utilidades/tokens.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';
import * as datosAuth from '../autenticacion/accesoDatosAutenticacion.js';

const RONDAS_BCRYPT = 10;

function sumarHoras(horas) {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

export async function cambiarContrasena(idUsuario, { contrasenaActual, contrasenaNueva, confirmacion }) {
  if (!contrasenaActual) {
    throw errorValidacion('La contraseña actual es obligatoria.', [{ campo: 'contrasenaActual', mensaje: 'La contraseña actual es obligatoria.' }]);
  }
  if (!contrasenaEsSegura(contrasenaNueva)) {
    throw errorValidacion('La nueva contraseña no cumple los requisitos.', [
      { campo: 'contrasenaNueva', mensaje: 'Debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.' }
    ]);
  }
  if (contrasenaNueva !== confirmacion) {
    throw errorValidacion('Las contraseñas no coinciden.', [{ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorId(idUsuario);
  if (!usuario) throw errorNoAutorizado('Usuario no encontrado.');
  const coincide = await bcrypt.compare(contrasenaActual, usuario.ContrasenaHash);
  if (!coincide) {
    throw errorNoAutorizado('La contraseña actual no es correcta.');
  }

  const contrasenaHash = await bcrypt.hash(contrasenaNueva, RONDAS_BCRYPT);
  await datosAuth.actualizarContrasena(idUsuario, contrasenaHash);
  await datosAuth.revocarSesionesUsuario(idUsuario);
}

export async function solicitarCambioCorreo(idUsuario, { correoNuevo, contrasenaActual }) {
  if (!correoEsValido(correoNuevo)) {
    throw errorValidacion('El correo nuevo no es válido.', [{ campo: 'correoNuevo', mensaje: 'El correo nuevo no es válido.' }]);
  }
  if (!contrasenaActual) {
    throw errorValidacion('La contraseña actual es obligatoria.', [{ campo: 'contrasenaActual', mensaje: 'La contraseña actual es obligatoria.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorId(idUsuario);
  if (!usuario) throw errorNoAutorizado('Usuario no encontrado.');
  if ((usuario.Correo || '').toLowerCase() === correoNuevo.toLowerCase()) {
    throw errorConflicto('El correo nuevo debe ser diferente al actual.');
  }

  const coincide = await bcrypt.compare(contrasenaActual, usuario.ContrasenaHash);
  if (!coincide) {
    throw errorNoAutorizado('La contraseña actual no es correcta.');
  }

  const existente = await datosAuth.obtenerUsuarioPorCorreo(correoNuevo);
  if (existente) {
    throw errorConflicto('El correo nuevo ya está registrado.');
  }

  await datosAuth.invalidarTokensCambioCorreoUsuario(idUsuario);
  const codigoCambio = generarCodigoOtp();
  await datosAuth.crearTokenCambioCorreo(
    idUsuario,
    correoNuevo,
    hashearValor(codigoCambio),
    sumarHoras(24)
  );

  await enviarCorreo({
    idUsuario,
    correoDestino: correoNuevo,
    asunto: 'Verificación de nuevo correo - SGBE CUC',
    tipoMensaje: 'CAMBIO_CORREO',
    contenidoHtml: `<p>Su código de verificación para cambiar el correo es:</p><p style="font-size: 24px;"><strong>${codigoCambio}</strong></p><p>Este código vence en 24 horas.</p>`
  });

  return { correoDestino: correoNuevo };
}

export async function verificarCambioCorreo(idUsuario, { correoNuevo, codigo }) {
  if (!correoEsValido(correoNuevo)) {
    throw errorValidacion('El correo nuevo no es válido.', [{ campo: 'correoNuevo', mensaje: 'El correo nuevo no es válido.' }]);
  }
  if (!codigo || !/^\d{6}$/.test(String(codigo))) {
    throw errorValidacion('El código debe tener 6 dígitos.', [{ campo: 'codigo', mensaje: 'El código debe tener 6 dígitos.' }]);
  }

  const usuario = await datosAuth.obtenerUsuarioPorId(idUsuario);
  if (!usuario) throw errorNoAutorizado('Usuario no encontrado.');

  const token = await datosAuth.obtenerTokenCambioCorreoVigentePorUsuario(
    idUsuario,
    correoNuevo,
    hashearValor(String(codigo))
  );
  if (!token) {
    throw errorNoAutorizado('El código de verificación no es válido o venció.');
  }

  await datosAuth.actualizarCorreoUsuario(idUsuario, correoNuevo);
  await datosAuth.marcarTokenCambioCorreoUsado(token.IdTokenCambioCorreo);
  return { correoActualizado: true, correo: correoNuevo };
}