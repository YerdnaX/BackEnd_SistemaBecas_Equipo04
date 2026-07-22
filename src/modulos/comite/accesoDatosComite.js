import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerExpedientesDisponibles(idConvocatoria) {
  const pool = await obtenerPool();
  const solicitud = pool.request();
  const filtroConvocatoria = idConvocatoria ? 'AND s.IdConvocatoria = @idConvocatoria' : '';
  if (idConvocatoria) solicitud.input('idConvocatoria', sql.Int, idConvocatoria);

  const resultado = await solicitud.query(`
    SELECT e.IdExpediente, e.CodigoExpediente, e.Estado, s.IdConvocatoria, c.Nombre AS NombreConvocatoria,
      u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
      r.PuntajeTotal, r.Posicion
    FROM dbo.Expedientes e
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    LEFT JOIN dbo.RankingsConvocatoria r ON r.IdExpediente = e.IdExpediente
    WHERE e.Estado = 'EN_COMITE' ${filtroConvocatoria}
    ORDER BY r.Posicion ASC
  `);
  return resultado.recordset;
}

export async function obtenerOCrearComitePorDefecto() {
  const pool = await obtenerPool();
  const existente = await pool.request().query("SELECT TOP 1 * FROM dbo.ComitesBeca WHERE Activo = 1 ORDER BY IdComite");
  if (existente.recordset[0]) return existente.recordset[0].IdComite;

  const creado = await pool.request().query(`
    INSERT INTO dbo.ComitesBeca (Nombre, Periodo)
    OUTPUT INSERTED.IdComite
    VALUES (N'Comité de Becas', N'Vigente')
  `);
  return creado.recordset[0].IdComite;
}

export async function crearSesion({ idComite, idConvocatoria, nombre, idCreadoPor, idsExpedientes }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('idComite', sql.Int, idComite)
      .input('idConvocatoria', sql.Int, idConvocatoria)
      .input('nombre', sql.NVarChar(150), nombre)
      .input('idCreadoPor', sql.Int, idCreadoPor)
      .query(`
        INSERT INTO dbo.SesionesComite (IdComite, IdConvocatoria, Nombre, IdCreadoPor)
        OUTPUT INSERTED.IdSesionComite
        VALUES (@idComite, @idConvocatoria, @nombre, @idCreadoPor)
      `);
    const idSesionComite = resultado.recordset[0].IdSesionComite;

    let orden = 1;
    for (const idExpediente of idsExpedientes) {
      await transaccion.request()
        .input('idSesionComite', sql.Int, idSesionComite)
        .input('idExpediente', sql.Int, idExpediente)
        .input('orden', sql.Int, orden)
        .query(`
          INSERT INTO dbo.CasosSesionComite (IdSesionComite, IdExpediente, OrdenRevision)
          VALUES (@idSesionComite, @idExpediente, @orden)
        `);
      orden += 1;
    }

    await transaccion.commit();
    return idSesionComite;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerSesionPorId(idSesionComite) {
  const pool = await obtenerPool();
  const sesion = await pool.request()
    .input('id', sql.Int, idSesionComite)
    .query(`
      SELECT sc.*, c.Nombre AS NombreConvocatoria
      FROM dbo.SesionesComite sc JOIN dbo.Convocatorias c ON c.IdConvocatoria = sc.IdConvocatoria
      WHERE sc.IdSesionComite = @id
    `);
  if (!sesion.recordset[0]) return null;

  const casos = await pool.request()
    .input('id', sql.Int, idSesionComite)
    .query(`
      SELECT cs.*, e.CodigoExpediente, s.IdUsuario, u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
        r.PuntajeTotal, r.Posicion,
        d.IdDecision, d.TipoDecision, d.PorcentajeBeca, d.Motivo, d.FechaDecision
      FROM dbo.CasosSesionComite cs
      JOIN dbo.Expedientes e ON e.IdExpediente = cs.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      LEFT JOIN dbo.RankingsConvocatoria r ON r.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.DecisionesComite d ON d.IdCasoSesion = cs.IdCasoSesion AND d.Vigente = 1
      WHERE cs.IdSesionComite = @id
      ORDER BY r.Posicion ASC
    `);

  return { ...sesion.recordset[0], casos: casos.recordset };
}

export async function obtenerCasoDeSesion(idSesionComite, idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSesionComite', sql.Int, idSesionComite)
    .input('idExpediente', sql.Int, idExpediente)
    .query('SELECT * FROM dbo.CasosSesionComite WHERE IdSesionComite = @idSesionComite AND IdExpediente = @idExpediente');
  return resultado.recordset[0] || null;
}

export async function registrarDecision({ idCasoSesion, tipoDecision, porcentajeBeca, motivo, idRegistradoPor }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idCasoSesion)
      .query('UPDATE dbo.DecisionesComite SET Vigente = 0 WHERE IdCasoSesion = @id AND Vigente = 1');

    await transaccion.request()
      .input('idCasoSesion', sql.Int, idCasoSesion)
      .input('tipoDecision', sql.VarChar(20), tipoDecision)
      .input('porcentajeBeca', sql.Decimal(5, 2), porcentajeBeca ?? null)
      .input('motivo', sql.NVarChar(600), motivo || null)
      .input('idRegistradoPor', sql.Int, idRegistradoPor)
      .query(`
        INSERT INTO dbo.DecisionesComite (IdCasoSesion, TipoDecision, PorcentajeBeca, Motivo, IdRegistradoPor)
        VALUES (@idCasoSesion, @tipoDecision, @porcentajeBeca, @motivo, @idRegistradoPor)
      `);

    await transaccion.request().input('id', sql.Int, idCasoSesion)
      .query("UPDATE dbo.CasosSesionComite SET Estado = 'DECIDIDO' WHERE IdCasoSesion = @id");

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function cerrarSesionTransaccion(idSesionComite) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const casos = await transaccion.request()
      .input('id', sql.Int, idSesionComite)
      .query(`
        SELECT cs.IdCasoSesion, cs.IdExpediente, d.IdDecision, d.TipoDecision, d.PorcentajeBeca, d.Motivo,
          e.IdSolicitud, s.IdUsuario
        FROM dbo.CasosSesionComite cs
        JOIN dbo.Expedientes e ON e.IdExpediente = cs.IdExpediente
        JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
        LEFT JOIN dbo.DecisionesComite d ON d.IdCasoSesion = cs.IdCasoSesion AND d.Vigente = 1
        WHERE cs.IdSesionComite = @id
      `);

    const resoluciones = [];
    for (const caso of casos.recordset) {
      if (!caso.IdDecision) {
        throw new Error('SESION_INCOMPLETA');
      }

      const numeroResolucion = `RES-${caso.IdExpediente}-${Date.now().toString().slice(-6)}`;
      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('idDecision', sql.Int, caso.IdDecision)
        .input('numeroResolucion', sql.NVarChar(40), numeroResolucion)
        .input('tipoResultado', sql.VarChar(20), caso.TipoDecision)
        .input('porcentajeBeca', sql.Decimal(5, 2), caso.PorcentajeBeca)
        .input('motivo', sql.NVarChar(600), caso.Motivo)
        .query(`
          INSERT INTO dbo.ResolucionesBeca (IdExpediente, IdDecision, NumeroResolucion, TipoResultado, PorcentajeBeca, Motivo, Publicada)
          VALUES (@idExpediente, @idDecision, @numeroResolucion, @tipoResultado, @porcentajeBeca, @motivo, 1)
        `);

      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('estado', sql.VarChar(30), caso.TipoDecision)
        .query('UPDATE dbo.Expedientes SET Estado = @estado, FechaCierre = SYSUTCDATETIME() WHERE IdExpediente = @idExpediente');

      await transaccion.request()
        .input('idSolicitud', sql.Int, caso.IdSolicitud)
        .input('estado', sql.VarChar(30), caso.TipoDecision)
        .query('UPDATE dbo.Solicitudes SET Estado = @estado, FechaActualizacion = SYSUTCDATETIME() WHERE IdSolicitud = @idSolicitud');

      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('estadoNuevo', sql.VarChar(30), caso.TipoDecision)
        .input('idUsuario', sql.Int, caso.IdUsuario)
        .query(`
          INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
          VALUES (@idExpediente, 'EN_COMITE', @estadoNuevo, @idUsuario, 'Resolución publicada por el comité.')
        `);

      resoluciones.push({ idUsuario: caso.IdUsuario, idSolicitud: caso.IdSolicitud, tipoResultado: caso.TipoDecision, numeroResolucion });
    }

    await transaccion.request().input('id', sql.Int, idSesionComite)
      .query("UPDATE dbo.SesionesComite SET Estado = 'CERRADA', FechaCierre = SYSUTCDATETIME() WHERE IdSesionComite = @id");

    await transaccion.commit();
    return resoluciones;
  } catch (error) {
    await transaccion.rollback();
    if (error.message === 'SESION_INCOMPLETA') {
      const errorPersonalizado = new Error('SESION_INCOMPLETA');
      errorPersonalizado.codigo = 'SESION_INCOMPLETA';
      throw errorPersonalizado;
    }
    throw error;
  }
}
