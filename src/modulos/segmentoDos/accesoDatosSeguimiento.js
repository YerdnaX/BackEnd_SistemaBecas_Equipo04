import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerBeneficioPropio(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idUsuario', sql.Int, idUsuario).query(`
    SELECT TOP 1 b.*, s.IdUsuario, da.Carrera, da.NumeroEstudiante
    FROM dbo.BecasActivas b
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
    WHERE s.IdUsuario = @idUsuario
    ORDER BY b.FechaActivacion DESC
  `);
  return resultado.recordset[0] || null;
}

export async function obtenerPropietarioBeneficio(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idBecaActiva).query(`
    SELECT s.IdUsuario FROM dbo.BecasActivas b
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    WHERE b.IdBecaActiva = @id
  `);
  return resultado.recordset[0] || null;
}

export async function listarSeguimientos(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idBecaActiva).query(`
    SELECT s.*, r.Promedio, r.CreditosMatriculados, r.CreditosAprobados,
      r.CursosPerdidos, r.CumpleRequisitos, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Responsable
    FROM dbo.SeguimientosBecado s
    LEFT JOIN dbo.RendimientosAcademicos r ON r.IdSeguimiento = s.IdSeguimiento
    LEFT JOIN dbo.Empleados e ON e.IdEmpleado = s.IdResponsable
    LEFT JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
    WHERE s.IdBecaActiva = @id
    ORDER BY s.FechaRevision DESC, s.IdSeguimiento DESC
  `);
  return resultado.recordset;
}

export async function crearSeguimiento(idBecaActiva, idUsuario, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('idUsuario', sql.Int, idUsuario)
    .input('periodo', sql.NVarChar(30), entrada.periodo)
    .input('estado', sql.VarChar(20), entrada.estado || 'PENDIENTE')
    .input('observaciones', sql.NVarChar(500), entrada.observaciones || null)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      INSERT INTO dbo.SeguimientosBecado
        (IdBecaActiva, Periodo, Estado, Observaciones, IdResponsable, FechaRevision)
      OUTPUT INSERTED.IdSeguimiento
      VALUES (@idBeca, @periodo, @estado, @observaciones, @IdEmpleado, SYSUTCDATETIME())
    `);
  return resultado.recordset[0]?.IdSeguimiento || null;
}

export async function crearRendimiento(idBecaActiva, idUsuario, entrada, evaluacion) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const seguimiento = await transaccion.request()
      .input('idBeca', sql.Int, idBecaActiva)
      .input('idUsuario', sql.Int, idUsuario)
      .input('periodo', sql.NVarChar(30), entrada.periodo)
      .input('estado', sql.VarChar(20), evaluacion.cumple ? 'CUMPLE' : 'NO_CUMPLE')
      .input('observaciones', sql.NVarChar(500), entrada.observaciones || null)
      .query(`
        DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
        INSERT INTO dbo.SeguimientosBecado
          (IdBecaActiva, Periodo, Estado, Observaciones, IdResponsable, FechaRevision)
        OUTPUT INSERTED.IdSeguimiento
        VALUES (@idBeca, @periodo, @estado, @observaciones, @IdEmpleado, SYSUTCDATETIME())
      `);
    const idSeguimiento = seguimiento.recordset[0].IdSeguimiento;
    await transaccion.request()
      .input('idSeguimiento', sql.Int, idSeguimiento)
      .input('promedio', sql.Decimal(5, 2), entrada.promedio)
      .input('matriculados', sql.Int, entrada.creditosMatriculados || 0)
      .input('aprobados', sql.Int, entrada.creditosAprobados || 0)
      .input('perdidos', sql.Int, entrada.cursosPerdidos || 0)
      .input('cumple', sql.Bit, evaluacion.cumple)
      .query(`
        INSERT INTO dbo.RendimientosAcademicos
          (IdSeguimiento, Promedio, CreditosMatriculados, CreditosAprobados, CursosPerdidos, CumpleRequisitos)
        VALUES (@idSeguimiento, @promedio, @matriculados, @aprobados, @perdidos, @cumple)
      `);
    for (const motivo of evaluacion.motivos) {
      await transaccion.request()
        .input('idSeguimiento', sql.Int, idSeguimiento)
        .input('tipo', sql.NVarChar(60), motivo)
        .input('descripcion', sql.NVarChar(400), `Regla de permanencia incumplida: ${motivo}.`)
        .query(`
          INSERT INTO dbo.AlertasSeguimiento (IdSeguimiento, Tipo, Descripcion, Nivel)
          VALUES (@idSeguimiento, @tipo, @descripcion, 'ADVERTENCIA')
        `);
    }
    await transaccion.commit();
    return idSeguimiento;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function listarAlertas(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idBecaActiva).query(`
    SELECT a.*, s.Periodo FROM dbo.AlertasSeguimiento a
    JOIN dbo.SeguimientosBecado s ON s.IdSeguimiento = a.IdSeguimiento
    WHERE s.IdBecaActiva = @id ORDER BY a.FechaCreacion DESC
  `);
  return resultado.recordset;
}

export async function crearAlerta(idBecaActiva, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('tipo', sql.NVarChar(60), entrada.tipo)
    .input('descripcion', sql.NVarChar(400), entrada.descripcion)
    .input('nivel', sql.VarChar(20), entrada.nivel || 'ADVERTENCIA')
    .query(`
      DECLARE @IdSeguimiento INT = (
        SELECT TOP 1 IdSeguimiento FROM dbo.SeguimientosBecado
        WHERE IdBecaActiva = @idBeca ORDER BY IdSeguimiento DESC
      );
      IF @IdSeguimiento IS NOT NULL
        INSERT INTO dbo.AlertasSeguimiento (IdSeguimiento, Tipo, Descripcion, Nivel)
        OUTPUT INSERTED.IdAlerta VALUES (@IdSeguimiento, @tipo, @descripcion, @nivel)
    `);
  return resultado.recordset[0]?.IdAlerta || null;
}

export async function cerrarAlerta(idAlerta, observacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idAlerta)
    .input('observacion', sql.NVarChar(500), observacion || null)
    .query(`
      UPDATE dbo.AlertasSeguimiento SET Estado = 'ATENDIDA', FechaAtencion = SYSUTCDATETIME(),
        ObservacionCierre = @observacion WHERE IdAlerta = @id AND Estado = 'ABIERTA'
      SELECT @@ROWCOUNT AS Filas;
    `);
  return resultado.recordset[0]?.Filas > 0;
}

export async function listarJustificacionesPropias(idUsuario) {
  const beneficio = await obtenerBeneficioPropio(idUsuario);
  if (!beneficio) return [];
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idBeca', sql.Int, beneficio.IdBecaActiva).query(`
    SELECT j.*, a.NombreOriginal
    FROM dbo.JustificacionesCurso j
    LEFT JOIN dbo.DocumentosJustificacion dj ON dj.IdJustificacion = j.IdJustificacion
    LEFT JOIN dbo.Archivos a ON a.IdArchivo = dj.IdArchivo
    WHERE j.IdBecaActiva = @idBeca ORDER BY j.FechaSolicitud DESC
  `);
  return resultado.recordset;
}

export async function listarJustificaciones(filtros = {}) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('estado', sql.VarChar(20), filtros.estado || null)
    .query(`
      SELECT j.IdJustificacion, j.IdBecaActiva, j.Periodo, j.Curso, j.Motivo,
        j.Estado, j.Resolucion, j.FechaSolicitud, j.FechaResolucion,
        CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Estudiante,
        da.NumeroEstudiante, da.Carrera, a.NombreOriginal, a.TipoMime
      FROM dbo.JustificacionesCurso j
      JOIN dbo.BecasActivas b ON b.IdBecaActiva = j.IdBecaActiva
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
      LEFT JOIN dbo.DocumentosJustificacion dj ON dj.IdJustificacion = j.IdJustificacion
      LEFT JOIN dbo.Archivos a ON a.IdArchivo = dj.IdArchivo
      WHERE (@estado IS NULL OR j.Estado = @estado)
      ORDER BY j.FechaSolicitud DESC
    `);
  return resultado.recordset;
}

export async function crearJustificacion(idBecaActiva, entrada, idArchivo) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('idBeca', sql.Int, idBecaActiva)
      .input('periodo', sql.NVarChar(30), entrada.periodo)
      .input('curso', sql.NVarChar(150), entrada.curso)
      .input('motivo', sql.NVarChar(500), entrada.motivo)
      .query(`
        INSERT INTO dbo.JustificacionesCurso (IdBecaActiva, Periodo, Curso, Motivo)
        OUTPUT INSERTED.IdJustificacion VALUES (@idBeca, @periodo, @curso, @motivo)
      `);
    const idJustificacion = resultado.recordset[0].IdJustificacion;
    if (idArchivo) {
      await transaccion.request().input('idJustificacion', sql.Int, idJustificacion)
        .input('idArchivo', sql.Int, idArchivo)
        .query(`
          INSERT INTO dbo.DocumentosJustificacion (IdJustificacion, IdArchivo)
          VALUES (@idJustificacion, @idArchivo)
        `);
    }
    await transaccion.commit();
    return idJustificacion;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerJustificacion(idJustificacion) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idJustificacion).query(`
    SELECT j.*, s.IdUsuario, a.IdArchivo, a.NombreOriginal, a.TipoMime
    FROM dbo.JustificacionesCurso j
    JOIN dbo.BecasActivas b ON b.IdBecaActiva = j.IdBecaActiva
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    LEFT JOIN dbo.DocumentosJustificacion dj ON dj.IdJustificacion = j.IdJustificacion
    LEFT JOIN dbo.Archivos a ON a.IdArchivo = dj.IdArchivo
    WHERE j.IdJustificacion = @id
  `);
  return resultado.recordset[0] || null;
}

export async function resolverJustificacion(idJustificacion, idUsuario, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idJustificacion)
    .input('idUsuario', sql.Int, idUsuario)
    .input('estado', sql.VarChar(20), entrada.estado)
    .input('resolucion', sql.NVarChar(500), entrada.resolucion)
    .query(`
      UPDATE dbo.JustificacionesCurso SET Estado = @estado, IdResueltoPor = @idUsuario,
        Resolucion = @resolucion, FechaResolucion = SYSUTCDATETIME()
      WHERE IdJustificacion = @id AND Estado = 'PENDIENTE'
      SELECT @@ROWCOUNT AS Filas;
    `);
  return resultado.recordset[0]?.Filas > 0;
}

export async function obtenerPeriodoRenovacionAbierto() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT TOP 1 * FROM dbo.PeriodosRenovacion
    WHERE Activo = 1 AND SYSUTCDATETIME() BETWEEN FechaInicio AND FechaFin
    ORDER BY FechaInicio DESC
  `);
  return resultado.recordset[0] || null;
}

export async function obtenerRenovacionPorBecaPeriodo(idBecaActiva, periodo) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('periodo', sql.NVarChar(30), periodo)
    .query(`
      SELECT TOP 1 IdRenovacion, EstadoProceso, ResultadoDetalle
      FROM dbo.RenovacionesBeca
      WHERE IdBecaActiva = @idBeca AND Periodo = @periodo
      ORDER BY IdRenovacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerRenovacion(idRenovacion) {
  const pool = await obtenerPool();
  const renovacion = await pool.request().input('id', sql.Int, idRenovacion).query(`
    SELECT r.*, r.EstadoProceso AS EstadoOperacion, s.IdUsuario, b.Porcentaje, b.Estado AS EstadoBeneficio,
      da.Carrera, da.NumeroEstudiante, da.Promedio,
      ev.CumpleAcademico, ev.CumpleSocioeconomico, ev.Observaciones AS ObservacionesEvaluacion,
      rr.Resultado, rr.ResultadoDetalle AS ResultadoResolucion, rr.PorcentajeNuevo, rr.Motivo
    FROM dbo.RenovacionesBeca r
    JOIN dbo.BecasActivas b ON b.IdBecaActiva = r.IdBecaActiva
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
    LEFT JOIN dbo.EvaluacionesRenovacion ev ON ev.IdRenovacion = r.IdRenovacion
    LEFT JOIN dbo.ResolucionesRenovacion rr ON rr.IdRenovacion = r.IdRenovacion
    WHERE r.IdRenovacion = @id
  `);
  if (!renovacion.recordset[0]) return null;
  const documentos = await pool.request().input('id', sql.Int, idRenovacion).query(`
    SELECT dr.IdDocumentoRenovacion, a.NombreOriginal, a.TipoMime, dr.FechaCarga
    FROM dbo.DocumentosRenovacion dr JOIN dbo.Archivos a ON a.IdArchivo = dr.IdArchivo
    WHERE dr.IdRenovacion = @id ORDER BY dr.FechaCarga DESC
  `);
  return {
    ...renovacion.recordset[0],
    Estado: renovacion.recordset[0].ResultadoDetalle || renovacion.recordset[0].EstadoOperacion,
    Resultado: renovacion.recordset[0].ResultadoResolucion,
    documentos: documentos.recordset
  };
}

export async function crearRenovacion(idBecaActiva, periodo, datosActualizados) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('periodo', sql.NVarChar(30), periodo)
    .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datosActualizados || {}))
    .query(`
      IF EXISTS (
        SELECT 1 FROM dbo.RenovacionesBeca WITH (UPDLOCK, HOLDLOCK)
        WHERE IdBecaActiva = @idBeca AND Periodo = @periodo
      )
        SELECT TOP 1 IdRenovacion, CAST(0 AS BIT) AS Creada FROM dbo.RenovacionesBeca
        WHERE IdBecaActiva = @idBeca AND Periodo = @periodo ORDER BY IdRenovacion DESC;
      ELSE
        INSERT INTO dbo.RenovacionesBeca (IdBecaActiva, Periodo, DatosActualizados)
        OUTPUT INSERTED.IdRenovacion, CAST(1 AS BIT) AS Creada
        VALUES (@idBeca, @periodo, @datos);
    `);
  return {
    idRenovacion: resultado.recordset[0].IdRenovacion,
    creada: Boolean(resultado.recordset[0].Creada)
  };
}

export async function actualizarRenovacion(idRenovacion, datosActualizados, enviar) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idRenovacion)
    .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datosActualizados || {}))
    .input('estado', sql.VarChar(25), enviar ? 'EN_REEVALUACION' : 'BORRADOR')
    .query(`
      UPDATE dbo.RenovacionesBeca SET DatosActualizados = @datos, EstadoProceso = @estado
      WHERE IdRenovacion = @id AND EstadoProceso = 'BORRADOR'
      SELECT @@ROWCOUNT AS Filas;
    `);
  return resultado.recordset[0]?.Filas > 0;
}

export async function agregarDocumentoRenovacion(idRenovacion, idArchivo, idTipoDocumento) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idRenovacion)
    .input('idArchivo', sql.Int, idArchivo)
    .input('idTipo', sql.Int, idTipoDocumento || null)
    .query(`
      INSERT INTO dbo.DocumentosRenovacion (IdRenovacion, IdArchivo, IdTipoDocumento)
      SELECT @id, @idArchivo, @idTipo
      WHERE EXISTS (
        SELECT 1 FROM dbo.RenovacionesBeca
        WHERE IdRenovacion = @id AND EstadoProceso = 'BORRADOR'
      )
      SELECT @@ROWCOUNT AS Filas;
    `);
  return resultado.recordset[0]?.Filas > 0;
}

export async function obtenerDocumentoRenovacion(idRenovacion, idDocumento) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idRenovacion', sql.Int, idRenovacion)
    .input('idDocumento', sql.Int, idDocumento)
    .query(`
      SELECT dr.IdDocumentoRenovacion, dr.IdArchivo
      FROM dbo.DocumentosRenovacion dr
      WHERE dr.IdRenovacion = @idRenovacion
        AND dr.IdDocumentoRenovacion = @idDocumento
    `);
  return resultado.recordset[0] || null;
}

export async function listarRenovaciones(filtros) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('estado', sql.VarChar(25), filtros.estado || null).query(`
    SELECT r.*, COALESCE(r.ResultadoDetalle, r.EstadoProceso) AS EstadoOperacion,
      CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Estudiante,
      da.NumeroEstudiante, da.Carrera, b.Porcentaje
    FROM dbo.RenovacionesBeca r
    JOIN dbo.BecasActivas b ON b.IdBecaActiva = r.IdBecaActiva
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
    WHERE (@estado IS NULL OR COALESCE(r.ResultadoDetalle, r.EstadoProceso) = @estado)
    ORDER BY r.FechaSolicitud DESC
  `);
  return resultado.recordset.map((renovacion) => ({ ...renovacion, Estado: renovacion.EstadoOperacion }));
}

export async function evaluarRenovacion(idRenovacion, idUsuario, entrada) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idRenovacion)
    .input('idUsuario', sql.Int, idUsuario)
    .input('academico', sql.Bit, entrada.cumpleAcademico)
    .input('socioeconomico', sql.Bit, entrada.cumpleSocioeconomico)
    .input('observaciones', sql.NVarChar(700), entrada.observaciones || null)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.EvaluacionesRenovacion WHERE IdRenovacion = @id)
        UPDATE dbo.EvaluacionesRenovacion SET IdEvaluador = @idUsuario, CumpleAcademico = @academico,
          CumpleSocioeconomico = @socioeconomico, Observaciones = @observaciones,
          FechaEvaluacion = SYSUTCDATETIME() WHERE IdRenovacion = @id;
      ELSE
        INSERT INTO dbo.EvaluacionesRenovacion
          (IdRenovacion, IdEvaluador, CumpleAcademico, CumpleSocioeconomico, Observaciones)
        VALUES (@id, @idUsuario, @academico, @socioeconomico, @observaciones);
    `);
}

export async function resolverRenovacion(idRenovacion, idUsuario, entrada) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const consulta = await transaccion.request().input('id', sql.Int, idRenovacion).query(`
      SELECT r.IdBecaActiva, r.EstadoProceso, s.IdUsuario
      FROM dbo.RenovacionesBeca r WITH (UPDLOCK, HOLDLOCK)
      JOIN dbo.BecasActivas b ON b.IdBecaActiva = r.IdBecaActiva
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      WHERE r.IdRenovacion = @id
        AND EXISTS (SELECT 1 FROM dbo.EvaluacionesRenovacion WHERE IdRenovacion = r.IdRenovacion)
    `);
    const renovacion = consulta.recordset[0];
    if (!renovacion || renovacion.EstadoProceso !== 'EN_REEVALUACION') {
      await transaccion.rollback();
      return null;
    }
    await transaccion.request().input('id', sql.Int, idRenovacion)
      .input('idUsuario', sql.Int, idUsuario)
      .input('resultado', sql.VarChar(20), entrada.resultado)
      .input('resultadoBase', sql.VarChar(20), ['RENOVADA', 'REDUCIDA'].includes(entrada.resultado) ? 'APROBADA' : 'RECHAZADA')
      .input('porcentaje', sql.Decimal(5, 2), entrada.porcentajeNuevo || null)
      .input('motivo', sql.NVarChar(500), entrada.motivo || null)
      .input('idBeca', sql.Int, renovacion.IdBecaActiva)
      .query(`
        INSERT INTO dbo.ResolucionesRenovacion
          (IdRenovacion, Resultado, ResultadoDetalle, PorcentajeNuevo, Motivo)
        VALUES (@id, @resultadoBase, @resultado, @porcentaje, @motivo);
        UPDATE dbo.RenovacionesBeca SET Estado = @resultadoBase, EstadoProceso = 'RESUELTA',
          ResultadoDetalle = @resultado, IdResueltoPor = @idUsuario,
          FechaResolucion = SYSUTCDATETIME() WHERE IdRenovacion = @id;
        IF @resultado IN ('RENOVADA','REDUCIDA')
          UPDATE dbo.BecasActivas SET Porcentaje = @porcentaje, Estado = 'ACTIVA' WHERE IdBecaActiva = @idBeca;
        IF @resultado = 'SUSPENDIDA'
          UPDATE dbo.BecasActivas SET Estado = 'SUSPENDIDA' WHERE IdBecaActiva = @idBeca;
      `);
    await transaccion.commit();
    return { idUsuario: renovacion.IdUsuario };
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}
