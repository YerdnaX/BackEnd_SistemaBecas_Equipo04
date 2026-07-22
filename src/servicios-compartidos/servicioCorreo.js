import nodemailer from 'nodemailer';
import { configuracion } from '../configuracion/variablesEntorno.js';
import { obtenerPool, sql } from '../configuracion/baseDatos.js';

let transportador = null;

function obtenerTransportador() {
  if (transportador) return transportador;

  if (configuracion.smtp.host) {
    transportador = nodemailer.createTransport({
      host: configuracion.smtp.host,
      port: configuracion.smtp.puerto,
      secure: configuracion.smtp.seguro,
      auth: configuracion.smtp.usuario
        ? { user: configuracion.smtp.usuario, pass: configuracion.smtp.contrasena }
        : undefined
    });
    return transportador;
  }

  if (configuracion.entorno === 'production') {
    throw new Error('SMTP no está configurado. Defina SMTP_HOST antes de enviar correos en producción.');
  }

  // Desarrollo sin SMTP configurado: transporte de prueba que no envía nada real,
  // solo registra el mensaje (jsonTransport). El registro en EnviosCorreo es real.
  transportador = nodemailer.createTransport({ jsonTransport: true });
  return transportador;
}

async function registrarEnvio({ idUsuario, correoDestino, asunto, tipoMensaje, estado, error }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario ?? null)
    .input('correoDestino', sql.NVarChar(150), correoDestino)
    .input('asunto', sql.NVarChar(200), asunto)
    .input('tipoMensaje', sql.NVarChar(60), tipoMensaje)
    .input('estado', sql.VarChar(20), estado)
    .input('error', sql.NVarChar(500), error ?? null)
    .query(`
      INSERT INTO dbo.EnviosCorreo (IdUsuario, CorreoDestino, Asunto, TipoMensaje, Estado, Intentos, FechaEnvio, Error)
      VALUES (@idUsuario, @correoDestino, @asunto, @tipoMensaje, @estado, 1,
              CASE WHEN @estado = 'ENVIADO' THEN SYSUTCDATETIME() ELSE NULL END, @error)
    `);
}

export async function enviarCorreo({ idUsuario = null, correoDestino, asunto, tipoMensaje, contenidoHtml }) {
  try {
    const transporte = obtenerTransportador();
    await transporte.sendMail({
      from: configuracion.smtp.remitente,
      to: correoDestino,
      subject: asunto,
      html: contenidoHtml
    });
    await registrarEnvio({ idUsuario, correoDestino, asunto, tipoMensaje, estado: 'ENVIADO' });
  } catch (error) {
    await registrarEnvio({
      idUsuario,
      correoDestino,
      asunto,
      tipoMensaje,
      estado: 'FALLIDO',
      error: error.message?.slice(0, 500)
    });
    if (configuracion.entorno === 'production') throw error;
  }
}
