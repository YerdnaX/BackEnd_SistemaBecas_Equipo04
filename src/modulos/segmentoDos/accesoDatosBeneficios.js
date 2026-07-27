import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

const CONDICIONES_VIGENTES = [
  'Mantener el rendimiento academico y la carga minima definidos por la institucion.',
  'Informar cambios academicos o socioeconomicos relevantes.',
  'Atender las revisiones y solicitudes de informacion de Bienestar Estudiantil.'
].join('\n');

export async function obtenerFormalizacionSolicitud(idSolicitud, idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT f.*, c.IdConvenio, c.NumeroConvenio, c.Firmado, c.FechaFirma,
        r.NumeroResolucion, r.TipoResultado, r.PorcentajeBeca, e.IdExpediente,
        b.IdBecaActiva, b.Estado AS EstadoBeneficio
      FROM dbo.Solicitudes s
      JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
      JOIN dbo.ResolucionesBeca r ON r.IdExpediente = e.IdExpediente AND r.Publicada = 1
      LEFT JOIN dbo.FormalizacionesBeca f ON f.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.ConveniosBeca c ON c.IdFormalizacion = f.IdFormalizacion
      LEFT JOIN dbo.BecasActivas b ON b.IdExpediente = e.IdExpediente
      WHERE s.IdSolicitud = @idSolicitud AND s.IdUsuario = @idUsuario
        AND r.TipoResultado IN ('APROBADA','CONDICIONADA')
    `);
  return resultado.recordset[0] || null;
}

export async function prepararFormalizacion(idSolicitud, idUsuario) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const base = await transaccion.request()
      .input('idSolicitud', sql.Int, idSolicitud)
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT TOP 1 e.IdExpediente, r.IdResolucion, r.NumeroResolucion, r.TipoResultado,
          r.PorcentajeBeca, c.IdTipoBeca
        FROM dbo.Solicitudes s
        JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
        JOIN dbo.ResolucionesBeca r ON r.IdExpediente = e.IdExpediente AND r.Publicada = 1
        JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
        WHERE s.IdSolicitud = @idSolicitud AND s.IdUsuario = @idUsuario
          AND r.TipoResultado IN ('APROBADA','CONDICIONADA')
        ORDER BY r.FechaEmision DESC
      `);
    const resolucion = base.recordset[0];
    if (!resolucion) {
      await transaccion.rollback();
      return null;
    }

    const existente = await transaccion.request()
      .input('idExpediente', sql.Int, resolucion.IdExpediente)
      .query('SELECT IdFormalizacion FROM dbo.FormalizacionesBeca WHERE IdExpediente = @idExpediente');

    let idFormalizacion = existente.recordset[0]?.IdFormalizacion;
    if (!idFormalizacion) {
      const creada = await transaccion.request()
        .input('idExpediente', sql.Int, resolucion.IdExpediente)
        .input('idResolucion', sql.Int, resolucion.IdResolucion)
        .input('condiciones', sql.NVarChar(sql.MAX), CONDICIONES_VIGENTES)
        .query(`
          INSERT INTO dbo.FormalizacionesBeca
            (IdExpediente, IdResolucion, Estado, VersionCondiciones, Condiciones)
          OUTPUT INSERTED.IdFormalizacion
          VALUES (@idExpediente, @idResolucion, 'GENERADA', '1.0', @condiciones)
        `);
      idFormalizacion = creada.recordset[0].IdFormalizacion;

      await transaccion.request()
        .input('idFormalizacion', sql.Int, idFormalizacion)
        .input('numero', sql.NVarChar(40), `CONV-${resolucion.NumeroResolucion}`)
        .input('contenido', sql.NVarChar(sql.MAX),
          `Convenio asociado a la resolucion ${resolucion.NumeroResolucion}.\n\n${CONDICIONES_VIGENTES}`)
        .query(`
          INSERT INTO dbo.ConveniosBeca (IdFormalizacion, NumeroConvenio, Contenido)
          VALUES (@idFormalizacion, @numero, @contenido)
        `);
    }

    await transaccion.commit();
    return idFormalizacion;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function aceptarFormalizacion(idSolicitud, idUsuario, direccionIp) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const consulta = await transaccion.request()
      .input('idSolicitud', sql.Int, idSolicitud)
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT f.IdFormalizacion, f.IdExpediente, f.VersionCondiciones, f.Estado,
          r.PorcentajeBeca, c.IdTipoBeca,
          CONCAT(YEAR(SYSUTCDATETIME()), '-', DATEPART(QUARTER, SYSUTCDATETIME())) AS Periodo
        FROM dbo.Solicitudes s
        JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
        JOIN dbo.FormalizacionesBeca f ON f.IdExpediente = e.IdExpediente
        JOIN dbo.ResolucionesBeca r ON r.IdResolucion = f.IdResolucion
        JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
        WHERE s.IdSolicitud = @idSolicitud AND s.IdUsuario = @idUsuario
      `);
    const formalizacion = consulta.recordset[0];
    if (!formalizacion) {
      await transaccion.rollback();
      return null;
    }

    await transaccion.request()
      .input('idFormalizacion', sql.Int, formalizacion.IdFormalizacion)
      .input('idUsuario', sql.Int, idUsuario)
      .input('version', sql.NVarChar(30), formalizacion.VersionCondiciones)
      .input('direccionIp', sql.VarChar(64), direccionIp || null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.AceptacionesFormalizacion WHERE IdFormalizacion = @idFormalizacion)
          INSERT INTO dbo.AceptacionesFormalizacion
            (IdFormalizacion, IdUsuario, VersionCondiciones, DireccionIp)
          VALUES (@idFormalizacion, @idUsuario, @version, @direccionIp);

        UPDATE dbo.FormalizacionesBeca
        SET Estado = 'ACEPTADA', FechaAceptacion = COALESCE(FechaAceptacion, SYSUTCDATETIME())
        WHERE IdFormalizacion = @idFormalizacion;
      `);

    await transaccion.request()
      .input('idFormalizacion', sql.Int, formalizacion.IdFormalizacion)
      .query(`
        UPDATE dbo.ConveniosBeca
        SET Firmado = 1, FechaFirma = COALESCE(FechaFirma, SYSUTCDATETIME())
        WHERE IdFormalizacion = @idFormalizacion
      `);

    const beca = await transaccion.request()
      .input('idExpediente', sql.Int, formalizacion.IdExpediente)
      .input('idTipoBeca', sql.Int, formalizacion.IdTipoBeca)
      .input('porcentaje', sql.Decimal(5, 2), formalizacion.PorcentajeBeca)
      .input('periodo', sql.NVarChar(30), formalizacion.Periodo)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.BecasActivas WHERE IdExpediente = @idExpediente)
          INSERT INTO dbo.BecasActivas (IdExpediente, IdTipoBeca, Porcentaje, Periodo)
          VALUES (@idExpediente, @idTipoBeca, @porcentaje, @periodo);
        SELECT IdBecaActiva FROM dbo.BecasActivas WHERE IdExpediente = @idExpediente;
      `);
    await transaccion.commit();
    return { idFormalizacion: formalizacion.IdFormalizacion, idBecaActiva: beca.recordset[0].IdBecaActiva };
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerConvenioSolicitud(idSolicitud, idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT c.NumeroConvenio, c.Contenido, c.Firmado, c.FechaFirma, f.VersionCondiciones
      FROM dbo.Solicitudes s
      JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
      JOIN dbo.FormalizacionesBeca f ON f.IdExpediente = e.IdExpediente
      JOIN dbo.ConveniosBeca c ON c.IdFormalizacion = f.IdFormalizacion
      WHERE s.IdSolicitud = @idSolicitud AND s.IdUsuario = @idUsuario
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerBeneficio(idBecaActiva) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idBecaActiva)
    .query(`
      SELECT b.*, tb.Nombre AS TipoBeca, e.CodigoExpediente, s.IdUsuario,
        va.Estado AS EstadoAcademico, va.Detalle AS DetalleAcademico,
        af.IdActivacionFinanciera, af.Estado AS EstadoFinanciero, af.Monto,
        af.Referencia, af.FechaVerificacion
      FROM dbo.BecasActivas b
      JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = b.IdTipoBeca
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      OUTER APPLY (
        SELECT TOP 1 * FROM dbo.ValidacionesAcademicas v
        WHERE v.IdExpediente = e.IdExpediente ORDER BY v.IdValidacionAcademica DESC
      ) va
      OUTER APPLY (
        SELECT TOP 1 * FROM dbo.ActivacionesFinancieras a
        WHERE a.IdBecaActiva = b.IdBecaActiva ORDER BY a.IdActivacionFinanciera DESC
      ) af
      WHERE b.IdBecaActiva = @id
    `);
  return resultado.recordset[0] || null;
}

export async function registrarValidacionAcademica(idBecaActiva, idUsuario, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('idUsuario', sql.Int, idUsuario)
    .input('periodo', sql.NVarChar(30), entrada.periodo)
    .input('estado', sql.VarChar(20), entrada.estado)
    .input('detalle', sql.NVarChar(400), entrada.detalle || null)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      DECLARE @IdExpediente INT = (SELECT IdExpediente FROM dbo.BecasActivas WHERE IdBecaActiva = @idBeca);
      IF EXISTS (SELECT 1 FROM dbo.ValidacionesAcademicas WHERE IdExpediente = @IdExpediente AND Periodo = @periodo)
        UPDATE dbo.ValidacionesAcademicas
        SET Estado = @estado, Detalle = @detalle, IdEmpleadoRegistro = @IdEmpleado,
          FechaValidacion = SYSUTCDATETIME()
        WHERE IdExpediente = @IdExpediente AND Periodo = @periodo;
      ELSE
        INSERT INTO dbo.ValidacionesAcademicas
          (IdExpediente, Periodo, Estado, Detalle, IdEmpleadoRegistro, FechaValidacion)
        VALUES (@IdExpediente, @periodo, @estado, @detalle, @IdEmpleado, SYSUTCDATETIME());
      SELECT IdUsuario FROM dbo.Solicitudes s JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
      WHERE e.IdExpediente = @IdExpediente;
    `);
  return resultado.recordset[0] || null;
}

export async function aplicarFinancieramente(idBecaActiva, idUsuario, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idBeca', sql.Int, idBecaActiva)
    .input('idUsuario', sql.Int, idUsuario)
    .input('periodo', sql.NVarChar(30), entrada.periodo)
    .input('porcentaje', sql.Decimal(5, 2), entrada.porcentaje)
    .input('monto', sql.Decimal(12, 2), entrada.monto || 0)
    .input('referencia', sql.NVarChar(100), entrada.referencia || null)
    .input('estado', sql.VarChar(20), entrada.resultado === 'FALLIDO' ? 'RECHAZADA' : 'PENDIENTE')
    .input('detalleError', sql.NVarChar(500), entrada.detalleError || null)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      IF EXISTS (SELECT 1 FROM dbo.ActivacionesFinancieras WHERE IdBecaActiva = @idBeca AND Periodo = @periodo)
      BEGIN
        SELECT IdActivacionFinanciera, Estado FROM dbo.ActivacionesFinancieras
        WHERE IdBecaActiva = @idBeca AND Periodo = @periodo;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.ActivacionesFinancieras
          (IdBecaActiva, Periodo, Porcentaje, Estado, Monto, Referencia, IdEmpleadoFinanzas, DetalleError)
        OUTPUT INSERTED.IdActivacionFinanciera, INSERTED.Estado
        VALUES (@idBeca, @periodo, @porcentaje, @estado, @monto, @referencia, @IdEmpleado, @detalleError);
      END
    `);
  return resultado.recordset[0] || null;
}

export async function verificarAplicacionFinanciera(idBecaActiva, idUsuario) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const consulta = await transaccion.request()
      .input('idBeca', sql.Int, idBecaActiva)
      .query(`
        SELECT b.IdExpediente, b.Estado, af.IdActivacionFinanciera, af.Estado AS EstadoFinanciero,
          af.Monto, af.Referencia, s.IdUsuario
        FROM dbo.BecasActivas b
        JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
        JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
        JOIN dbo.ActivacionesFinancieras af ON af.IdBecaActiva = b.IdBecaActiva
        WHERE b.IdBecaActiva = @idBeca
          AND EXISTS (
            SELECT 1 FROM dbo.ValidacionesAcademicas va
            WHERE va.IdExpediente = b.IdExpediente AND va.Estado = 'VALIDADA'
          )
        ORDER BY af.IdActivacionFinanciera DESC
      `);
    const aplicacion = consulta.recordset[0];
    if (!aplicacion || aplicacion.EstadoFinanciero !== 'PENDIENTE') {
      await transaccion.rollback();
      return null;
    }

    await transaccion.request()
      .input('idBeca', sql.Int, idBecaActiva)
      .input('idActivacion', sql.Int, aplicacion.IdActivacionFinanciera)
      .input('monto', sql.Decimal(12, 2), aplicacion.Monto)
      .input('referencia', sql.NVarChar(100), aplicacion.Referencia || `APL-${aplicacion.IdActivacionFinanciera}`)
      .query(`
        UPDATE dbo.ActivacionesFinancieras
        SET Estado = 'VERIFICADA', FechaVerificacion = SYSUTCDATETIME()
        WHERE IdActivacionFinanciera = @idActivacion;
        IF NOT EXISTS (SELECT 1 FROM dbo.AsientosFinancieros WHERE IdActivacionFinanciera = @idActivacion)
          INSERT INTO dbo.AsientosFinancieros (IdActivacionFinanciera, Referencia, Monto, Estado)
          VALUES (@idActivacion, @referencia, @monto, 'VERIFICADO');
        UPDATE dbo.BecasActivas
        SET Estado = 'ACTIVA', FechaInicio = COALESCE(FechaInicio, SYSUTCDATETIME()),
          FechaActivacion = COALESCE(FechaActivacion, SYSUTCDATETIME())
        WHERE IdBecaActiva = @idBeca;
      `);

    await transaccion.request()
      .input('idUsuario', sql.Int, aplicacion.IdUsuario)
      .query(`
        DECLARE @IdRol INT = (SELECT IdRol FROM dbo.Roles WHERE Codigo = 'BECADO');
        IF NOT EXISTS (SELECT 1 FROM dbo.UsuariosRoles WHERE IdUsuario = @idUsuario AND IdRol = @IdRol)
          INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol) VALUES (@idUsuario, @IdRol);
        ELSE
          UPDATE dbo.UsuariosRoles SET Activo = 1 WHERE IdUsuario = @idUsuario AND IdRol = @IdRol;
      `);
    await transaccion.commit();
    return { idUsuario: aplicacion.IdUsuario };
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerPanelBecado(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1 b.IdBecaActiva, b.Porcentaje, b.Periodo, b.Estado, b.FechaActivacion,
        tb.Nombre AS TipoBeca, e.CodigoExpediente, da.Promedio, da.CreditosMatriculados,
        (SELECT COUNT(*) FROM dbo.AlertasSeguimiento a
          JOIN dbo.SeguimientosBecado sg ON sg.IdSeguimiento = a.IdSeguimiento
          WHERE sg.IdBecaActiva = b.IdBecaActiva AND a.Estado = 'ABIERTA') AS AlertasAbiertas
      FROM dbo.BecasActivas b
      JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = b.IdTipoBeca
      LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
      WHERE s.IdUsuario = @idUsuario
      ORDER BY b.FechaActivacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerExpedienteBecado(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1 e.IdExpediente, e.CodigoExpediente, u.Nombre, u.PrimerApellido,
        u.SegundoApellido, u.Correo, dp.Identificacion, dp.Telefono, dp.Direccion,
        dp.ContactoEmergencia, dp.TelefonoEmergencia, da.NumeroEstudiante, da.Carrera,
        da.NivelAcademico, da.Promedio, da.CreditosMatriculados, ds.SituacionLaboral,
        ds.Observaciones, b.IdBecaActiva, b.Porcentaje, b.Periodo, b.Estado
      FROM dbo.Usuarios u
      JOIN dbo.Solicitudes s ON s.IdUsuario = u.IdUsuario
      JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
      JOIN dbo.BecasActivas b ON b.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.DatosPersonalesSolicitud dp ON dp.IdSolicitud = s.IdSolicitud
      LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
      LEFT JOIN dbo.DatosSocioeconomicosSolicitud ds ON ds.IdSolicitud = s.IdSolicitud
      WHERE u.IdUsuario = @idUsuario
      ORDER BY b.FechaActivacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function actualizarCampoExpediente(idUsuario, idExpediente, campo, valor, sensible) {
  const mapa = {
    telefono: ['DatosPersonalesSolicitud', 'Telefono'],
    direccion: ['DatosPersonalesSolicitud', 'Direccion'],
    contactoEmergencia: ['DatosPersonalesSolicitud', 'ContactoEmergencia'],
    telefonoEmergencia: ['DatosPersonalesSolicitud', 'TelefonoEmergencia'],
    situacionLaboral: ['DatosSocioeconomicosSolicitud', 'SituacionLaboral'],
    observaciones: ['DatosSocioeconomicosSolicitud', 'Observaciones']
  };
  const [tabla, columna] = mapa[campo];
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const anterior = await transaccion.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idExpediente', sql.Int, idExpediente)
      .query(`
        SELECT x.${columna} AS ValorAnterior
        FROM dbo.Expedientes e
        JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud AND s.IdUsuario = @idUsuario
        JOIN dbo.${tabla} x ON x.IdSolicitud = s.IdSolicitud
        WHERE e.IdExpediente = @idExpediente
      `);
    if (!anterior.recordset[0]) {
      await transaccion.rollback();
      return false;
    }
    await transaccion.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idExpediente', sql.Int, idExpediente)
      .input('valor', sql.NVarChar(500), valor ?? null)
      .input('campo', sql.NVarChar(80), campo)
      .input('valorAnterior', sql.NVarChar(500), anterior.recordset[0].ValorAnterior ?? null)
      .input('sensible', sql.Bit, sensible)
      .query(`
        UPDATE x SET ${columna} = @valor
        FROM dbo.${tabla} x
        JOIN dbo.Solicitudes s ON s.IdSolicitud = x.IdSolicitud AND s.IdUsuario = @idUsuario
        JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
        WHERE e.IdExpediente = @idExpediente;
        INSERT INTO dbo.ActualizacionesExpediente
          (IdExpediente, IdUsuario, Campo, ValorAnterior, ValorNuevo, RequiereRevision)
        VALUES (@idExpediente, @idUsuario, @campo, @valorAnterior, @valor, @sensible);
      `);
    await transaccion.commit();
    return true;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function listarHistorialExpediente(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT a.* FROM dbo.ActualizacionesExpediente a
      JOIN dbo.Expedientes e ON e.IdExpediente = a.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      WHERE s.IdUsuario = @idUsuario
      ORDER BY a.Fecha DESC
    `);
  return resultado.recordset;
}
