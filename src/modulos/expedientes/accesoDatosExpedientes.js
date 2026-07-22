import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function listarExpedientes({ estado, idConvocatoria, idEmpleadoResponsable, pagina = 1, tamanoPagina = 20 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (estado) { solicitud.input('estado', sql.VarChar(30), estado); condiciones.push('e.Estado = @estado'); }
  if (idConvocatoria) { solicitud.input('idConvocatoria', sql.Int, idConvocatoria); condiciones.push('s.IdConvocatoria = @idConvocatoria'); }
  if (idEmpleadoResponsable) {
    solicitud.input('idEmpleado', sql.Int, idEmpleadoResponsable);
    condiciones.push(`EXISTS (SELECT 1 FROM dbo.AsignacionesExpediente a WHERE a.IdExpediente = e.IdExpediente AND a.Activa = 1 AND a.IdEmpleado = @idEmpleado)`);
  }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT e.*, s.IdConvocatoria, s.IdUsuario, c.Nombre AS NombreConvocatoria,
      u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
      (SELECT TOP 1 emp.NumeroEmpleado FROM dbo.AsignacionesExpediente a
        JOIN dbo.Empleados emp ON emp.IdEmpleado = a.IdEmpleado
        WHERE a.IdExpediente = e.IdExpediente AND a.Activa = 1) AS ResponsableAsignado,
      COUNT(*) OVER() AS TotalRegistros
    FROM dbo.Expedientes e
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    ${filtro}
    ORDER BY e.FechaApertura DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function obtenerExpedientePorId(idExpediente) {
  const pool = await obtenerPool();
  const expediente = await pool.request()
    .input('id', sql.Int, idExpediente)
    .query(`
      SELECT e.*, s.IdConvocatoria, s.IdUsuario, s.Estado AS EstadoSolicitud,
        c.Nombre AS NombreConvocatoria, u.Nombre AS NombreAspirante,
        u.PrimerApellido AS ApellidoAspirante, u.SegundoApellido AS SegundoApellidoAspirante, u.Correo AS CorreoAspirante
      FROM dbo.Expedientes e
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      WHERE e.IdExpediente = @id
    `);
  return expediente.recordset[0] || null;
}

export async function obtenerHistorialExpediente(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idExpediente)
    .query('SELECT * FROM dbo.HistorialEstadosExpediente WHERE IdExpediente = @id ORDER BY Fecha DESC');
  return resultado.recordset;
}

export async function asignarExpediente(idExpediente, idEmpleado, idAsignadoPor) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idExpediente)
      .query('UPDATE dbo.AsignacionesExpediente SET Activa = 0, FechaFin = SYSUTCDATETIME() WHERE IdExpediente = @id AND Activa = 1');

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('idEmpleado', sql.Int, idEmpleado)
      .input('idAsignadoPor', sql.Int, idAsignadoPor)
      .query(`
        INSERT INTO dbo.AsignacionesExpediente (IdExpediente, IdEmpleado, IdAsignadoPor)
        VALUES (@idExpediente, @idEmpleado, @idAsignadoPor)
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function registrarHistorialExpediente({ idExpediente, estadoAnterior, estadoNuevo, idUsuario, observacion }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('estadoAnterior', sql.VarChar(30), estadoAnterior)
    .input('estadoNuevo', sql.VarChar(30), estadoNuevo)
    .input('idUsuario', sql.Int, idUsuario)
    .input('observacion', sql.NVarChar(500), observacion || null)
    .query(`
      INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
      VALUES (@idExpediente, @estadoAnterior, @estadoNuevo, @idUsuario, @observacion)
    `);
}

export async function cambiarEstadoExpedienteYSolicitud(idExpediente, estadoNuevo) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('estado', sql.VarChar(30), estadoNuevo)
      .query('UPDATE dbo.Expedientes SET Estado = @estado WHERE IdExpediente = @idExpediente');

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('estado', sql.VarChar(30), estadoNuevo)
      .query(`
        UPDATE dbo.Solicitudes SET Estado = @estado, FechaActualizacion = SYSUTCDATETIME()
        WHERE IdSolicitud = (SELECT IdSolicitud FROM dbo.Expedientes WHERE IdExpediente = @idExpediente)
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

// --- Documentos del expediente ---

export async function listarDocumentosExpediente(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idExpediente)
    .query(`
      SELECT d.*, r.Nombre AS NombreRequisito, r.Obligatorio
      FROM dbo.DocumentosSolicitud d
      LEFT JOIN dbo.RequisitosConvocatoria r ON r.IdRequisito = d.IdRequisito
      WHERE d.Activo = 1 AND d.IdSolicitud = (SELECT IdSolicitud FROM dbo.Expedientes WHERE IdExpediente = @id)
      ORDER BY d.FechaCarga DESC
    `);
  return resultado.recordset;
}

export async function obtenerDocumentoDeExpediente(idExpediente, idDocumento) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('idDocumento', sql.Int, idDocumento)
    .query(`
      SELECT d.* FROM dbo.DocumentosSolicitud d
      WHERE d.IdDocumentoSolicitud = @idDocumento AND d.Activo = 1
        AND d.IdSolicitud = (SELECT IdSolicitud FROM dbo.Expedientes WHERE IdExpediente = @idExpediente)
    `);
  return resultado.recordset[0] || null;
}

export async function registrarRevisionDocumento({ idDocumentoSolicitud, idRevisor, estadoAnterior, estadoNuevo, observacion }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('id', sql.Int, idDocumentoSolicitud)
      .input('estado', sql.VarChar(30), estadoNuevo)
      .query('UPDATE dbo.DocumentosSolicitud SET Estado = @estado WHERE IdDocumentoSolicitud = @id');

    await transaccion.request()
      .input('idDocumento', sql.Int, idDocumentoSolicitud)
      .input('idRevisor', sql.Int, idRevisor)
      .input('estadoAnterior', sql.VarChar(30), estadoAnterior)
      .input('estadoNuevo', sql.VarChar(30), estadoNuevo)
      .input('observacion', sql.NVarChar(500), observacion || null)
      .query(`
        INSERT INTO dbo.RevisionesDocumento (IdDocumentoSolicitud, IdRevisor, EstadoAnterior, EstadoNuevo, Observacion)
        VALUES (@idDocumento, @idRevisor, @estadoAnterior, @estadoNuevo, @observacion)
      `);

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

// --- Elegibilidad ---

export async function registrarElegibilidad({ idExpediente, esElegible, motivo, idResueltoPor }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('esElegible', sql.Bit, esElegible)
    .input('motivo', sql.NVarChar(500), motivo || null)
    .input('idResueltoPor', sql.Int, idResueltoPor)
    .query(`
      INSERT INTO dbo.ElegibilidadesExpediente (IdExpediente, EsElegible, Motivo, IdResueltoPor)
      VALUES (@idExpediente, @esElegible, @motivo, @idResueltoPor)
    `);
}

// --- Evaluacion ---

export async function listarComponentesEvaluacion() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query('SELECT * FROM dbo.ComponentesEvaluacion WHERE Activo = 1 ORDER BY IdComponente');
  return resultado.recordset;
}

export async function obtenerEvaluacionVigente(idExpediente) {
  const pool = await obtenerPool();
  const evaluacion = await pool.request()
    .input('id', sql.Int, idExpediente)
    .query('SELECT TOP 1 * FROM dbo.EvaluacionesExpediente WHERE IdExpediente = @id ORDER BY IdEvaluacion DESC');
  if (!evaluacion.recordset[0]) return null;

  const puntajes = await pool.request()
    .input('idEvaluacion', sql.Int, evaluacion.recordset[0].IdEvaluacion)
    .query(`
      SELECT p.*, c.Nombre AS NombreComponente, c.Codigo AS CodigoComponente
      FROM dbo.PuntajesEvaluacion p JOIN dbo.ComponentesEvaluacion c ON c.IdComponente = p.IdComponente
      WHERE p.IdEvaluacion = @idEvaluacion
    `);

  return { ...evaluacion.recordset[0], puntajes: puntajes.recordset };
}

export async function guardarEvaluacion({ idExpediente, idEvaluador, puntajeTotal, puntajesPorComponente }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('idEvaluador', sql.Int, idEvaluador)
      .input('puntajeTotal', sql.Decimal(6, 2), puntajeTotal)
      .query(`
        INSERT INTO dbo.EvaluacionesExpediente (IdExpediente, IdEvaluador, Estado, PuntajeTotal, FechaFinalizacion)
        OUTPUT INSERTED.IdEvaluacion
        VALUES (@idExpediente, @idEvaluador, 'COMPLETA', @puntajeTotal, SYSUTCDATETIME())
      `);
    const idEvaluacion = resultado.recordset[0].IdEvaluacion;

    for (const item of puntajesPorComponente) {
      await transaccion.request()
        .input('idEvaluacion', sql.Int, idEvaluacion)
        .input('idComponente', sql.Int, item.idComponente)
        .input('puntaje', sql.Decimal(5, 2), item.puntaje)
        .input('porcentajeAplicado', sql.Decimal(5, 2), item.porcentaje)
        .input('puntajePonderado', sql.Decimal(6, 2), item.puntajePonderado)
        .input('observacion', sql.NVarChar(400), item.observacion || null)
        .query(`
          INSERT INTO dbo.PuntajesEvaluacion (IdEvaluacion, IdComponente, Puntaje, PorcentajeAplicado, PuntajePonderado, Observacion)
          VALUES (@idEvaluacion, @idComponente, @puntaje, @porcentajeAplicado, @puntajePonderado, @observacion)
        `);
    }

    await transaccion.commit();
    return idEvaluacion;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function recalcularRankingConvocatoria(idConvocatoria) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idConvocatoria)
      .query('DELETE FROM dbo.RankingsConvocatoria WHERE IdConvocatoria = @id');

    const evaluados = await transaccion.request()
      .input('id', sql.Int, idConvocatoria)
      .query(`
        SELECT e.IdExpediente, ev.PuntajeTotal, s.FechaEnvio
        FROM dbo.Expedientes e
        JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
        JOIN dbo.EvaluacionesExpediente ev ON ev.IdExpediente = e.IdExpediente AND ev.Estado = 'COMPLETA'
        WHERE s.IdConvocatoria = @id AND e.Estado IN ('EVALUADA', 'EN_COMITE', 'APROBADA', 'CONDICIONADA', 'LISTA_ESPERA', 'RECHAZADA')
        ORDER BY ev.PuntajeTotal DESC, s.FechaEnvio ASC
      `);

    let posicion = 1;
    for (const fila of evaluados.recordset) {
      await transaccion.request()
        .input('idConvocatoria', sql.Int, idConvocatoria)
        .input('idExpediente', sql.Int, fila.IdExpediente)
        .input('puntajeTotal', sql.Decimal(6, 2), fila.PuntajeTotal)
        .input('posicion', sql.Int, posicion)
        .query(`
          INSERT INTO dbo.RankingsConvocatoria (IdConvocatoria, IdExpediente, PuntajeTotal, Posicion)
          VALUES (@idConvocatoria, @idExpediente, @puntajeTotal, @posicion)
        `);
      posicion += 1;
    }

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}
