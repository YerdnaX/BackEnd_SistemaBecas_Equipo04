import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerResolucionParaApelar(idResolucion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idResolucion)
    .query(`
      SELECT r.IdResolucion, r.IdExpediente, r.TipoResultado, r.PorcentajeBeca, r.Publicada, r.FechaEmision,
        e.Estado AS EstadoExpediente, e.SoloLectura, s.IdUsuario
      FROM dbo.ResolucionesBeca r
      JOIN dbo.Expedientes e ON e.IdExpediente = r.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      WHERE r.IdResolucion = @id
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerApelacionActivaPorResolucion(idResolucion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idResolucion', sql.Int, idResolucion)
    .query(`
      SELECT * FROM dbo.Apelaciones
      WHERE IdResolucion = @idResolucion AND Estado IN ('PRESENTADA','EN_REVISION')
    `);
  return resultado.recordset[0] || null;
}

export async function crearApelacion({ idExpediente, idResolucion, motivo, fechaLimite }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('idResolucion', sql.Int, idResolucion)
    .input('motivo', sql.NVarChar(800), motivo)
    .input('fechaLimite', sql.DateTime2, fechaLimite)
    .query(`
      INSERT INTO dbo.Apelaciones (IdExpediente, IdResolucion, Motivo, Estado, FechaLimite)
      OUTPUT INSERTED.IdApelacion
      VALUES (@idExpediente, @idResolucion, @motivo, 'PRESENTADA', @fechaLimite)
    `);
  return resultado.recordset[0].IdApelacion;
}

export async function crearApelacionRechazadaPorPlazo({ idExpediente, idResolucion, motivo }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('idResolucion', sql.Int, idResolucion)
    .input('motivo', sql.NVarChar(800), motivo)
    .query(`
      INSERT INTO dbo.Apelaciones (IdExpediente, IdResolucion, Motivo, Estado)
      OUTPUT INSERTED.IdApelacion
      VALUES (@idExpediente, @idResolucion, @motivo, 'RESUELTA')
    `);
  return resultado.recordset[0].IdApelacion;
}

export async function agregarDocumentoApelacion(idApelacion, idArchivo) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idApelacion', sql.Int, idApelacion)
    .input('idArchivo', sql.Int, idArchivo)
    .query('INSERT INTO dbo.DocumentosApelacion (IdApelacion, IdArchivo) VALUES (@idApelacion, @idArchivo)');
}

export async function listarDocumentosApelacion(idApelacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idApelacion', sql.Int, idApelacion)
    .query(`
      SELECT d.IdDocumentoApelacion, d.IdArchivo, d.FechaCarga, a.NombreOriginal
      FROM dbo.DocumentosApelacion d JOIN dbo.Archivos a ON a.IdArchivo = d.IdArchivo
      WHERE d.IdApelacion = @idApelacion
    `);
  return resultado.recordset;
}

export async function listarApelaciones({ estado, idUsuario, pagina = 1, tamanoPagina = 20 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (estado) { solicitud.input('estado', sql.VarChar(20), estado); condiciones.push('ap.Estado = @estado'); }
  if (idUsuario) { solicitud.input('idUsuario', sql.Int, idUsuario); condiciones.push('s.IdUsuario = @idUsuario'); }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT ap.*, s.IdUsuario, u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
      r.TipoResultado, r.NumeroResolucion, COUNT(*) OVER() AS TotalRegistros
    FROM dbo.Apelaciones ap
    JOIN dbo.Expedientes e ON e.IdExpediente = ap.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    LEFT JOIN dbo.ResolucionesBeca r ON r.IdResolucion = ap.IdResolucion
    ${filtro}
    ORDER BY ap.FechaPresentacion DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function obtenerApelacionPorId(idApelacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idApelacion)
    .query(`
      SELECT ap.*, s.IdUsuario, u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
        r.TipoResultado, r.NumeroResolucion, r.PorcentajeBeca
      FROM dbo.Apelaciones ap
      JOIN dbo.Expedientes e ON e.IdExpediente = ap.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      LEFT JOIN dbo.ResolucionesBeca r ON r.IdResolucion = ap.IdResolucion
      WHERE ap.IdApelacion = @id
    `);
  return resultado.recordset[0] || null;
}

export async function asignarRevisor(idApelacion, idRevisor) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idApelacion)
    .input('idRevisor', sql.Int, idRevisor)
    .query(`UPDATE dbo.Apelaciones SET IdRevisor = @idRevisor, Estado = 'EN_REVISION' WHERE IdApelacion = @id`);
}

export async function registrarRevisionApelacion(idApelacion, idRevisor, observaciones) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idApelacion', sql.Int, idApelacion)
    .input('idRevisor', sql.Int, idRevisor)
    .input('observaciones', sql.NVarChar(600), observaciones ?? null)
    .query(`
      INSERT INTO dbo.RevisionesApelacion (IdApelacion, IdRevisor, Observaciones)
      VALUES (@idApelacion, @idRevisor, @observaciones)
    `);
}

export async function resolverApelacionTransaccion({ idApelacion, idExpediente, idResolucion, aFavor, resultado, motivo, nuevoPorcentaje, idResueltoPor, idUsuarioAspirante }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('id', sql.Int, idApelacion)
      .input('estado', sql.VarChar(20), 'RESUELTA')
      .query('UPDATE dbo.Apelaciones SET Estado = @estado WHERE IdApelacion = @id');

    await transaccion.request()
      .input('idApelacion', sql.Int, idApelacion)
      .input('resultado', sql.VarChar(20), resultado)
      .input('motivo', sql.NVarChar(600), motivo ?? null)
      .input('idResueltoPor', sql.Int, idResueltoPor)
      .query(`
        INSERT INTO dbo.ResolucionesApelacion (IdApelacion, Resultado, Motivo, IdResueltoPor)
        VALUES (@idApelacion, @resultado, @motivo, @idResueltoPor)
      `);

    if (aFavor && nuevoPorcentaje !== undefined && nuevoPorcentaje !== null) {
      await transaccion.request()
        .input('idResolucion', sql.Int, idResolucion)
        .input('porcentaje', sql.Decimal(5, 2), nuevoPorcentaje)
        .query('UPDATE dbo.ResolucionesBeca SET PorcentajeBeca = @porcentaje WHERE IdResolucion = @idResolucion');
    }

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('estadoNuevo', sql.VarChar(30), aFavor ? 'CONDICIONADA' : 'RECHAZADA')
      .input('idUsuario', sql.Int, idResueltoPor)
      .input('observacion', sql.NVarChar(500), `Resultado de apelación #${idApelacion}: ${aFavor ? 'a favor' : 'en contra'}.`)
      .query(`
        INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
        SELECT @idExpediente, e.Estado, e.Estado, @idUsuario, @observacion FROM dbo.Expedientes e WHERE e.IdExpediente = @idExpediente
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function contarApelacionesPendientesExpediente(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .query(`
      SELECT COUNT(*) AS Total FROM dbo.Apelaciones
      WHERE IdExpediente = @idExpediente AND Estado IN ('PRESENTADA','EN_REVISION')
    `);
  return resultado.recordset[0].Total;
}
