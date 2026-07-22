import { obtenerPool, sql } from '../configuracion/baseDatos.js';

export async function crearNotificacion(transaccionOrPool, { idUsuario, tipo, titulo, mensaje, enlace = null }) {
  const ejecutor = transaccionOrPool ?? await obtenerPool();
  await ejecutor.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('tipo', sql.NVarChar(60), tipo)
    .input('titulo', sql.NVarChar(150), titulo)
    .input('mensaje', sql.NVarChar(600), mensaje)
    .input('enlace', sql.NVarChar(300), enlace)
    .query(`
      INSERT INTO dbo.Notificaciones (IdUsuario, Tipo, Titulo, Mensaje, Enlace)
      VALUES (@idUsuario, @tipo, @titulo, @mensaje, @enlace)
    `);
}

export async function listarNotificaciones(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT IdNotificacion, Tipo, Titulo, Mensaje, Enlace, Leida, FechaCreacion, FechaLectura
      FROM dbo.Notificaciones WHERE IdUsuario = @idUsuario
      ORDER BY FechaCreacion DESC
    `);
  return resultado.recordset;
}

export async function marcarNotificacionLeida(idUsuario, idNotificacion) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('idNotificacion', sql.Int, idNotificacion)
    .query(`
      UPDATE dbo.Notificaciones SET Leida = 1, FechaLectura = SYSUTCDATETIME()
      WHERE IdNotificacion = @idNotificacion AND IdUsuario = @idUsuario
    `);
}
