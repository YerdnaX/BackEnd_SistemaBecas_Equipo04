import { obtenerPool, sql } from '../configuracion/baseDatos.js';

export async function registrarAuditoria({ idUsuario = null, modulo, accion, entidad = null, idEntidad = null, detalle = null, direccionIp = null }) {
  try {
    const pool = await obtenerPool();
    await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('modulo', sql.NVarChar(60), modulo)
      .input('accion', sql.NVarChar(60), accion)
      .input('entidad', sql.NVarChar(60), entidad)
      .input('idEntidad', sql.Int, idEntidad)
      .input('detalle', sql.NVarChar(1000), detalle ? String(detalle).slice(0, 1000) : null)
      .input('direccionIp', sql.VarChar(64), direccionIp)
      .query(`
        INSERT INTO dbo.AuditoriaAcciones (IdUsuario, Modulo, Accion, Entidad, IdEntidad, Detalle, DireccionIp)
        VALUES (@idUsuario, @modulo, @accion, @entidad, @idEntidad, @detalle, @direccionIp)
      `);
  } catch (error) {
    // La auditoria nunca debe impedir la operacion principal; se registra en consola sin secretos.
    // eslint-disable-next-line no-console
    console.error('No fue posible registrar auditoria:', error.message);
  }
}

export async function registrarEventoSeguridad({ idUsuario = null, tipoEvento, descripcion = null, nivel = 'INFO', direccionIp = null }) {
  try {
    const pool = await obtenerPool();
    await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('tipoEvento', sql.NVarChar(60), tipoEvento)
      .input('descripcion', sql.NVarChar(500), descripcion)
      .input('nivel', sql.VarChar(20), nivel)
      .input('direccionIp', sql.VarChar(64), direccionIp)
      .query(`
        INSERT INTO dbo.EventosSeguridad (IdUsuario, TipoEvento, Descripcion, Nivel, DireccionIp)
        VALUES (@idUsuario, @tipoEvento, @descripcion, @nivel, @direccionIp)
      `);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('No fue posible registrar evento de seguridad:', error.message);
  }
}
