import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerBecaActivaPorId(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idBecaActiva)
    .query(`
      SELECT b.*, e.IdExpediente, e.SoloLectura, s.IdUsuario
      FROM dbo.BecasActivas b
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      WHERE b.IdBecaActiva = @id
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerInvestigacionAbiertaPorBeca(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBecaActiva', sql.Int, idBecaActiva)
    .query(`
      SELECT * FROM dbo.InvestigacionesBeca
      WHERE IdBecaActiva = @idBecaActiva AND Estado IN ('ABIERTA','EN_REVISION')
    `);
  return resultado.recordset[0] || null;
}

export async function crearInvestigacion({ idBecaActiva, causal, descripcion, idResponsable }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBecaActiva', sql.Int, idBecaActiva)
    .input('causal', sql.NVarChar(150), causal)
    .input('descripcion', sql.NVarChar(600), descripcion ?? null)
    .input('idResponsable', sql.Int, idResponsable ?? null)
    .query(`
      INSERT INTO dbo.InvestigacionesBeca (IdBecaActiva, Causal, Descripcion, Estado, IdResponsable)
      OUTPUT INSERTED.IdInvestigacion
      VALUES (@idBecaActiva, @causal, @descripcion, 'EN_REVISION', @idResponsable)
    `);
  return resultado.recordset[0].IdInvestigacion;
}

export async function obtenerInvestigacionPorId(idInvestigacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idInvestigacion)
    .query(`
      SELECT inv.*, b.IdExpediente, s.IdUsuario, u.Nombre AS NombreBecado, u.PrimerApellido AS ApellidoBecado
      FROM dbo.InvestigacionesBeca inv
      JOIN dbo.BecasActivas b ON b.IdBecaActiva = inv.IdBecaActiva
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      WHERE inv.IdInvestigacion = @id
    `);
  return resultado.recordset[0] || null;
}

export async function listarInvestigaciones({ estado, idUsuario, pagina = 1, tamanoPagina = 20 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (estado) { solicitud.input('estado', sql.VarChar(20), estado); condiciones.push('inv.Estado = @estado'); }
  if (idUsuario) { solicitud.input('idUsuario', sql.Int, idUsuario); condiciones.push('s.IdUsuario = @idUsuario'); }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT inv.*, s.IdUsuario, u.Nombre AS NombreBecado, u.PrimerApellido AS ApellidoBecado,
      COUNT(*) OVER() AS TotalRegistros
    FROM dbo.InvestigacionesBeca inv
    JOIN dbo.BecasActivas b ON b.IdBecaActiva = inv.IdBecaActiva
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    ${filtro}
    ORDER BY inv.FechaApertura DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function crearDescargo({ idInvestigacion, idUsuario, detalle, idArchivo }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idInvestigacion', sql.Int, idInvestigacion)
    .input('idUsuario', sql.Int, idUsuario)
    .input('detalle', sql.NVarChar(800), detalle)
    .input('idArchivo', sql.Int, idArchivo ?? null)
    .query(`
      INSERT INTO dbo.DescargosBeca (IdInvestigacion, IdUsuario, Detalle, IdArchivo)
      VALUES (@idInvestigacion, @idUsuario, @detalle, @idArchivo)
    `);
}

export async function listarDescargos(idInvestigacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idInvestigacion', sql.Int, idInvestigacion)
    .query('SELECT * FROM dbo.DescargosBeca WHERE IdInvestigacion = @idInvestigacion ORDER BY FechaPresentacion DESC');
  return resultado.recordset;
}

export async function pasarAAnalisis(idInvestigacion) {
  const pool = await obtenerPool();
  // Nota: Estado permanece en 'EN_REVISION' (el CHECK de la tabla no admite
  // un valor 'EN_ANALISIS'). El paso "pasar a analisis" ahora queda
  // registrado de forma observable en FechaAnalisis.
  await pool.request()
    .input('id', sql.Int, idInvestigacion)
    .query(`UPDATE dbo.InvestigacionesBeca SET FechaAnalisis = SYSUTCDATETIME() WHERE IdInvestigacion = @id`);
}

export async function resolverInvestigacionTransaccion({ idInvestigacion, idBecaActiva, resultadoDb, estadoBecaNuevo, motivo, idResueltoPor }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('idInvestigacion', sql.Int, idInvestigacion)
      .input('resultado', sql.VarChar(20), resultadoDb)
      .input('motivo', sql.NVarChar(600), motivo ?? null)
      .input('idResueltoPor', sql.Int, idResueltoPor)
      .query(`
        INSERT INTO dbo.ResolucionesSuspension (IdInvestigacion, Resultado, Motivo, IdResueltoPor)
        VALUES (@idInvestigacion, @resultado, @motivo, @idResueltoPor)
      `);

    await transaccion.request()
      .input('id', sql.Int, idInvestigacion)
      .query(`UPDATE dbo.InvestigacionesBeca SET Estado = 'CERRADA', FechaCierre = SYSUTCDATETIME() WHERE IdInvestigacion = @id`);

    await transaccion.request()
      .input('idBecaActiva', sql.Int, idBecaActiva)
      .input('estadoAnterior', sql.VarChar(20), null)
      .input('estadoNuevo', sql.VarChar(20), estadoBecaNuevo)
      .input('idUsuario', sql.Int, idResueltoPor)
      .input('motivo', sql.NVarChar(400), motivo ? motivo.slice(0, 400) : null)
      .query(`
        INSERT INTO dbo.HistorialEstadosBeca (IdBecaActiva, EstadoAnterior, EstadoNuevo, Motivo, IdUsuario)
        SELECT @idBecaActiva, b.Estado, @estadoNuevo, @motivo, @idUsuario FROM dbo.BecasActivas b WHERE b.IdBecaActiva = @idBecaActiva;

        UPDATE dbo.BecasActivas SET Estado = @estadoNuevo WHERE IdBecaActiva = @idBecaActiva;
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}
