import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { configuracion } from '../configuracion/variablesEntorno.js';
import { obtenerPool, sql } from '../configuracion/baseDatos.js';

let transportador = null;
let clienteGmail = null;
let transportadorMIME = null;

function correoGoogleConfigurado() {
  return Boolean(
    configuracion.googleCorreo.clientId
    && configuracion.googleCorreo.clientSecret
    && configuracion.googleCorreo.refreshToken
    && configuracion.googleCorreo.usuario
  );
}

function smtpConfigurado() {
  return Boolean(configuracion.smtp.host);
}

function repararMojibake(texto) {
  let valor = String(texto || '');
  for (let i = 0; i < 3; i += 1) {
    if (!/[ÃÂ]/.test(valor)) break;
    const reparado = Buffer.from(valor, 'latin1').toString('utf8');
    if (reparado === valor) break;
    valor = reparado;
  }
  return valor;
}

function normalizarAsunto(asunto) {
  const reparado = repararMojibake(asunto);
  // Fallback conservador para evitar problemas de encabezado en clientes
  // que no respetan completamente la codificación RFC del Subject.
  return reparado
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obtenerTransportadorMIME() {
  if (transportadorMIME) return transportadorMIME;
  // Genera un mensaje MIME en memoria (sin envío de red) con codificación correcta.
  transportadorMIME = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'windows'
  });
  return transportadorMIME;
}

async function construirRawCorreo({ from, to, subject, html }) {
  const compositor = obtenerTransportadorMIME();
  const asuntoSeguro = normalizarAsunto(subject);
  const resultado = await compositor.sendMail({
    from,
    to,
    subject: asuntoSeguro,
    html,
    text: 'Este mensaje requiere un cliente de correo con soporte HTML.'
  });

  return resultado.message
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function obtenerClienteGmail() {
  if (clienteGmail) return clienteGmail;

  if (!correoGoogleConfigurado()) {
    throw new Error('Google API no está configurado para envío de correo.');
  }

  const oauth2 = new google.auth.OAuth2(
    configuracion.googleCorreo.clientId,
    configuracion.googleCorreo.clientSecret,
    configuracion.googleCorreo.redirectUri
  );

  oauth2.setCredentials({ refresh_token: configuracion.googleCorreo.refreshToken });
  clienteGmail = google.gmail({ version: 'v1', auth: oauth2 });
  return clienteGmail;
}

async function enviarConGoogleApi({ correoDestino, asunto, contenidoHtml }) {
  const gmail = obtenerClienteGmail();
  const raw = await construirRawCorreo({
    from: configuracion.smtp.remitente,
    to: correoDestino,
    subject: asunto,
    html: contenidoHtml
  });
  await gmail.users.messages.send({
    userId: configuracion.googleCorreo.usuario,
    requestBody: { raw }
  });
}

function obtenerTransportador() {
  if (transportador) return transportador;

  if (smtpConfigurado()) {
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

  // Desarrollo sin SMTP configurado: transporte de prueba que no envía nada real,
  // solo registra el mensaje (jsonTransport). El registro en EnviosCorreo es real.
  transportador = nodemailer.createTransport({ jsonTransport: true });
  return transportador;
}

async function enviarCorreoProveedor({ correoDestino, asunto, contenidoHtml }) {
  if (correoGoogleConfigurado()) {
    await enviarConGoogleApi({ correoDestino, asunto, contenidoHtml });
    return;
  }

  if (smtpConfigurado() || configuracion.entorno !== 'production') {
    const transporte = obtenerTransportador();
    await transporte.sendMail({
      from: configuracion.smtp.remitente,
      to: correoDestino,
      subject: asunto,
      html: contenidoHtml
    });
    return;
  }

  throw new Error('No hay proveedor de correo configurado. Defina GOOGLE_OAUTH_* o SMTP_* en producción.');
}

async function registrarEnvio({ idUsuario, correoDestino, asunto, tipoMensaje, contenidoHtml, estado, error }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario ?? null)
    .input('correoDestino', sql.NVarChar(150), correoDestino)
    .input('asunto', sql.NVarChar(200), asunto)
    .input('tipoMensaje', sql.NVarChar(60), tipoMensaje)
    .input('contenidoHtml', sql.NVarChar(sql.MAX), contenidoHtml ?? null)
    .input('estado', sql.VarChar(20), estado)
    .input('error', sql.NVarChar(500), error ?? null)
    .query(`
      INSERT INTO dbo.EnviosCorreo (IdUsuario, CorreoDestino, Asunto, TipoMensaje, ContenidoHtml, Estado, Intentos, FechaEnvio, Error)
      OUTPUT INSERTED.IdEnvioCorreo
      VALUES (@idUsuario, @correoDestino, @asunto, @tipoMensaje, @contenidoHtml, @estado, 1,
              CASE WHEN @estado = 'ENVIADO' THEN SYSUTCDATETIME() ELSE NULL END, @error)
    `);
  return resultado.recordset[0].IdEnvioCorreo;
}

async function actualizarEnvioTrasReintento(idEnvioCorreo, { estado, error }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idEnvioCorreo)
    .input('estado', sql.VarChar(20), estado)
    .input('error', sql.NVarChar(500), error ?? null)
    .query(`
      UPDATE dbo.EnviosCorreo
      SET Estado = @estado, Intentos = Intentos + 1, Error = @error,
          FechaEnvio = CASE WHEN @estado = 'ENVIADO' THEN SYSUTCDATETIME() ELSE FechaEnvio END
      WHERE IdEnvioCorreo = @id
    `);
}

export async function enviarCorreo({ idUsuario = null, correoDestino, asunto, tipoMensaje, contenidoHtml }) {
  try {
    await enviarCorreoProveedor({ correoDestino, asunto, contenidoHtml });
    await registrarEnvio({ idUsuario, correoDestino, asunto, tipoMensaje, contenidoHtml, estado: 'ENVIADO' });
    return { enviado: true };
  } catch (error) {
    await registrarEnvio({
      idUsuario,
      correoDestino,
      asunto,
      tipoMensaje,
      contenidoHtml,
      estado: 'FALLIDO',
      error: error.message?.slice(0, 500)
    });
    if (configuracion.entorno === 'production') throw error;
    return { enviado: false, motivo: 'FALLIDO', error: error.message?.slice(0, 500) };
  }
}

// F34: reintenta los envios que quedaron en estado FALLIDO, hasta el
// maximo de intentos definido en NOTIFICACION_REINTENTOS_MAXIMOS.
// Es idempotente: cada intento exitoso deja el registro en ENVIADO y no
// se vuelve a tocar; los que agotan intentos quedan como FALLIDO
// definitivo para revisión manual.
export async function reintentarEnviosFallidos(maximoIntentos = 3) {
  const pool = await obtenerPool();
  const pendientes = await pool.request()
    .input('maximoIntentos', sql.Int, maximoIntentos)
    .query(`
      SELECT TOP 50 * FROM dbo.EnviosCorreo
      WHERE Estado = 'FALLIDO' AND Intentos < @maximoIntentos AND ContenidoHtml IS NOT NULL
      ORDER BY FechaCreacion ASC
    `);

  const resultados = { reintentados: 0, exitosos: 0, fallidos: 0 };
  for (const envio of pendientes.recordset) {
    resultados.reintentados += 1;
    try {
      await enviarCorreoProveedor({
        correoDestino: envio.CorreoDestino,
        asunto: envio.Asunto,
        contenidoHtml: envio.ContenidoHtml
      });
      await actualizarEnvioTrasReintento(envio.IdEnvioCorreo, { estado: 'ENVIADO' });
      resultados.exitosos += 1;
    } catch (error) {
      await actualizarEnvioTrasReintento(envio.IdEnvioCorreo, { estado: 'FALLIDO', error: error.message?.slice(0, 500) });
      resultados.fallidos += 1;
    }
  }
  return resultados;
}
