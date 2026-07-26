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
    const transporte = obtenerTransportador();
    await transporte.sendMail({
      from: configuracion.smtp.remitente,
      to: correoDestino,
      subject: asunto,
      html: contenidoHtml
    });
    await registrarEnvio({ idUsuario, correoDestino, asunto, tipoMensaje, contenidoHtml, estado: 'ENVIADO' });
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
      const transporte = obtenerTransportador();
      await transporte.sendMail({
        from: configuracion.smtp.remitente,
        to: envio.CorreoDestino,
        subject: envio.Asunto,
        html: envio.ContenidoHtml
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
