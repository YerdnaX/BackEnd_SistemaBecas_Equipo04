import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerExpedienteBase(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idExpediente)
    .query(`
      SELECT e.IdExpediente, e.Estado, e.SoloLectura, e.CodigoExpediente, s.IdUsuario,
        (SELECT TOP 1 b.IdBecaActiva FROM dbo.BecasActivas b WHERE b.IdExpediente = e.IdExpediente) AS IdBecaActiva
      FROM dbo.Expedientes e
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      WHERE e.IdExpediente = @id
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerBloqueadoresCierre(idExpediente, idBecaActiva) {
  const pool = await obtenerPool();
  const solicitud = pool.request().input('idExpediente', sql.Int, idExpediente);
  if (idBecaActiva) solicitud.input('idBecaActiva', sql.Int, idBecaActiva);

  const resultado = await solicitud.query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Apelaciones WHERE IdExpediente = @idExpediente AND Estado IN ('PRESENTADA','EN_REVISION')) AS ApelacionesPendientes,
      ${idBecaActiva ? `
      (SELECT COUNT(*) FROM dbo.InvestigacionesBeca WHERE IdBecaActiva = @idBecaActiva AND Estado IN ('ABIERTA','EN_REVISION')) AS InvestigacionesPendientes,
      (SELECT COUNT(*) FROM dbo.JustificacionesCurso WHERE IdBecaActiva = @idBecaActiva AND Estado = 'PENDIENTE') AS JustificacionesPendientes,
      (SELECT COUNT(*) FROM dbo.RenovacionesBeca WHERE IdBecaActiva = @idBecaActiva AND Estado = 'PENDIENTE') AS RenovacionesPendientes
      ` : `0 AS InvestigacionesPendientes, 0 AS JustificacionesPendientes, 0 AS RenovacionesPendientes`}
  `);
  return resultado.recordset[0];
}

export async function cerrarExpediente({ idExpediente, motivo, resumen, idCerradoPor }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('motivo', sql.NVarChar(400), motivo)
      .input('resumen', sql.NVarChar(800), resumen ?? null)
      .input('idCerradoPor', sql.Int, idCerradoPor)
      .query(`
        INSERT INTO dbo.CierresExpediente (IdExpediente, Motivo, Resumen, IdCerradoPor)
        VALUES (@idExpediente, @motivo, @resumen, @idCerradoPor)
      `);

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .query(`
        UPDATE dbo.Expedientes SET SoloLectura = 1, FechaCierre = SYSUTCDATETIME() WHERE IdExpediente = @idExpediente
      `);

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('idUsuario', sql.Int, idCerradoPor)
      .input('observacion', sql.NVarChar(500), motivo.slice(0, 500))
      .query(`
        INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
        SELECT @idExpediente, e.Estado, e.Estado, @idUsuario, CONCAT('CIERRE: ', @observacion) FROM dbo.Expedientes e WHERE e.IdExpediente = @idExpediente
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerCierre(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .query('SELECT * FROM dbo.CierresExpediente WHERE IdExpediente = @idExpediente');
  return resultado.recordset[0] || null;
}
