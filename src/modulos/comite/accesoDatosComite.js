import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerExpedientesDisponibles(idConvocatoria) {
  const pool = await obtenerPool();
  const solicitud = pool.request();
  const filtroConvocatoria = idConvocatoria ? 'AND s.IdConvocatoria = @idConvocatoria' : '';
  if (idConvocatoria) solicitud.input('idConvocatoria', sql.Int, idConvocatoria);
  const resultado = await solicitud.query(`
    SELECT e.IdExpediente, e.CodigoExpediente, e.Estado, s.IdConvocatoria,
      c.Nombre AS NombreConvocatoria, c.Periodo,
      u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
      r.PuntajeTotal, r.Posicion, pq.Quintil, pq.IngresoPerCapita, pq.AnioReferencia,
      tb.PorcentajeCobertura AS PorcentajeDefinido,
      i.Recomendacion AS RecomendacionSocial
    FROM dbo.Expedientes e
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
    JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    JOIN dbo.PrecalculosQuintil pq ON pq.IdExpediente = e.IdExpediente AND pq.Quintil <= 2
    JOIN dbo.InformesSocialesExpediente i ON i.IdExpediente = e.IdExpediente
    LEFT JOIN dbo.RankingsConvocatoria r ON r.IdExpediente = e.IdExpediente
    WHERE e.Estado = 'EN_COMITE' ${filtroConvocatoria}
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.CasosSesionComite casoExistente
        JOIN dbo.SesionesComite sesionExistente
          ON sesionExistente.IdSesionComite = casoExistente.IdSesionComite
        WHERE casoExistente.IdExpediente = e.IdExpediente
          AND sesionExistente.Estado = 'ABIERTA'
      )
    ORDER BY r.Posicion ASC
  `);
  return resultado.recordset;
}

export async function listarSesionesParaUsuario(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idUsuario', sql.Int, idUsuario).query(`
    SELECT sc.IdSesionComite, sc.Nombre, sc.Estado, sc.FechaSesion,
      sc.FechaCreacion, sc.FechaCierre, c.Nombre AS NombreConvocatoria, c.Periodo,
      CONCAT(creador.Nombre, ' ', creador.PrimerApellido) AS NombreCreador,
      (SELECT COUNT(*)
       FROM dbo.CasosSesionComite cs
       WHERE cs.IdSesionComite = sc.IdSesionComite) AS TotalCasos,
      (SELECT COUNT(*)
       FROM dbo.MiembrosSesionComite ms
       WHERE ms.IdSesionComite = sc.IdSesionComite) AS TotalMiembros,
      (SELECT COUNT(*)
       FROM dbo.VotosComite v
       JOIN dbo.CasosSesionComite cs ON cs.IdCasoSesion = v.IdCasoSesion
       WHERE cs.IdSesionComite = sc.IdSesionComite) AS TotalVotos,
      (SELECT COUNT(*)
       FROM dbo.VotosComite v
       JOIN dbo.CasosSesionComite cs ON cs.IdCasoSesion = v.IdCasoSesion
       JOIN dbo.MiembrosComite mc ON mc.IdMiembroComite = v.IdMiembroComite
       JOIN dbo.Empleados emp ON emp.IdEmpleado = mc.IdEmpleado
       WHERE cs.IdSesionComite = sc.IdSesionComite
         AND emp.IdUsuario = @idUsuario) AS MisVotos
    FROM dbo.SesionesComite sc
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = sc.IdConvocatoria
    JOIN dbo.Usuarios creador ON creador.IdUsuario = sc.IdCreadoPor
    WHERE EXISTS (
      SELECT 1
      FROM dbo.MiembrosSesionComite ms
      JOIN dbo.MiembrosComite mc ON mc.IdMiembroComite = ms.IdMiembroComite
      JOIN dbo.Empleados emp ON emp.IdEmpleado = mc.IdEmpleado
      WHERE ms.IdSesionComite = sc.IdSesionComite
        AND emp.IdUsuario = @idUsuario
    )
    ORDER BY CASE WHEN sc.Estado = 'ABIERTA' THEN 0 ELSE 1 END,
      sc.FechaCreacion DESC, sc.IdSesionComite DESC
  `);
  return resultado.recordset.map((sesion) => ({
    ...sesion,
    VotosEsperados: Number(sesion.TotalCasos) * Number(sesion.TotalMiembros),
    MisVotosPendientes: Math.max(Number(sesion.TotalCasos) - Number(sesion.MisVotos), 0)
  }));
}

export async function obtenerOCrearComitePorDefecto() {
  const pool = await obtenerPool();
  const existente = await pool.request().query('SELECT TOP 1 * FROM dbo.ComitesBeca WHERE Activo = 1 ORDER BY IdComite');
  if (existente.recordset[0]) return existente.recordset[0].IdComite;
  const creado = await pool.request().query(`
    INSERT INTO dbo.ComitesBeca (Nombre, Periodo)
    OUTPUT INSERTED.IdComite VALUES (N'Comite de Becas', N'Vigente')
  `);
  return creado.recordset[0].IdComite;
}

export async function listarMiembrosVigentes(idComite) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idComite', sql.Int, idComite).query(`
    SELECT m.IdMiembroComite, m.IdEmpleado, m.Cargo, e.IdUsuario,
      CONCAT(u.Nombre, ' ', u.PrimerApellido) AS NombreMiembro
    FROM dbo.MiembrosComite m
    JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado AND e.Activo = 1
    JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario AND u.Activo = 1
    WHERE m.IdComite = @idComite AND m.Activo = 1
      AND m.FechaInicio <= SYSUTCDATETIME()
      AND (m.FechaFin IS NULL OR m.FechaFin > SYSUTCDATETIME())
    ORDER BY m.IdMiembroComite
  `);
  return resultado.recordset;
}

export async function crearSesion({ idComite, idConvocatoria, nombre, idCreadoPor, idsExpedientes, miembros }) {
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

    for (const miembro of miembros) {
      await transaccion.request()
        .input('idSesion', sql.Int, idSesionComite)
        .input('idMiembro', sql.Int, miembro.IdMiembroComite)
        .query(`
          INSERT INTO dbo.MiembrosSesionComite (IdSesionComite, IdMiembroComite)
          VALUES (@idSesion, @idMiembro)
        `);
    }

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

export async function obtenerSesionPorId(idSesionComite, idUsuarioActual) {
  const pool = await obtenerPool();
  const sesion = await pool.request().input('id', sql.Int, idSesionComite).query(`
    SELECT sc.*, c.Nombre AS NombreConvocatoria, c.Periodo
    FROM dbo.SesionesComite sc
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = sc.IdConvocatoria
    WHERE sc.IdSesionComite = @id
  `);
  if (!sesion.recordset[0]) return null;

  const [casos, miembros, votos] = await Promise.all([
    pool.request().input('id', sql.Int, idSesionComite).query(`
      SELECT cs.*, e.CodigoExpediente, s.IdUsuario,
        u.Nombre AS NombreAspirante, u.PrimerApellido AS ApellidoAspirante,
        r.PuntajeTotal, r.Posicion, pq.Quintil, pq.IngresoPerCapita, pq.AnioReferencia,
        tb.PorcentajeCobertura AS PorcentajeDefinido,
        i.Resumen AS ResumenSocial, i.Hallazgos AS HallazgosSociales,
        i.Recomendacion AS RecomendacionSocial, i.Observaciones AS ObservacionesSociales,
        d.IdDecision, d.TipoDecision, d.Motivo, d.FechaDecision
      FROM dbo.CasosSesionComite cs
      JOIN dbo.Expedientes e ON e.IdExpediente = cs.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
      JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
      JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      LEFT JOIN dbo.RankingsConvocatoria r ON r.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.PrecalculosQuintil pq ON pq.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.InformesSocialesExpediente i ON i.IdExpediente = e.IdExpediente
      LEFT JOIN dbo.DecisionesComite d ON d.IdCasoSesion = cs.IdCasoSesion AND d.Vigente = 1
      WHERE cs.IdSesionComite = @id
      ORDER BY cs.OrdenRevision ASC
    `),
    pool.request().input('id', sql.Int, idSesionComite).query(`
      SELECT ms.IdMiembroSesion, m.IdMiembroComite, m.Cargo, e.IdUsuario,
        CONCAT(u.Nombre, ' ', u.PrimerApellido) AS NombreMiembro
      FROM dbo.MiembrosSesionComite ms
      JOIN dbo.MiembrosComite m ON m.IdMiembroComite = ms.IdMiembroComite
      JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado
      JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
      WHERE ms.IdSesionComite = @id ORDER BY m.IdMiembroComite
    `),
    pool.request().input('id', sql.Int, idSesionComite).query(`
      SELECT v.*, e.IdUsuario, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS NombreMiembro
      FROM dbo.VotosComite v
      JOIN dbo.CasosSesionComite cs ON cs.IdCasoSesion = v.IdCasoSesion
      JOIN dbo.MiembrosComite m ON m.IdMiembroComite = v.IdMiembroComite
      JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado
      JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
      WHERE cs.IdSesionComite = @id
    `)
  ]);

  const listaMiembros = miembros.recordset;
  const miembroActual = listaMiembros.find((miembro) => miembro.IdUsuario === idUsuarioActual) || null;
  return {
    ...sesion.recordset[0],
    miembros: listaMiembros,
    miembroActual,
    casos: casos.recordset.map((caso) => ({
      ...caso,
      votos: votos.recordset.filter((voto) => voto.IdCasoSesion === caso.IdCasoSesion),
      votoActual: miembroActual
        ? votos.recordset.find((voto) => voto.IdCasoSesion === caso.IdCasoSesion
          && voto.IdMiembroComite === miembroActual.IdMiembroComite) || null
        : null
    }))
  };
}

export async function obtenerCasoDeSesion(idSesionComite, idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSesionComite', sql.Int, idSesionComite)
    .input('idExpediente', sql.Int, idExpediente)
    .query('SELECT * FROM dbo.CasosSesionComite WHERE IdSesionComite = @idSesionComite AND IdExpediente = @idExpediente');
  return resultado.recordset[0] || null;
}

export async function obtenerMiembroSesionPorUsuario(idSesionComite, idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSesion', sql.Int, idSesionComite)
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT m.IdMiembroComite
      FROM dbo.MiembrosSesionComite ms
      JOIN dbo.MiembrosComite m ON m.IdMiembroComite = ms.IdMiembroComite
      JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado
      WHERE ms.IdSesionComite = @idSesion AND e.IdUsuario = @idUsuario
    `);
  return resultado.recordset[0] || null;
}

export async function registrarVoto({ idCasoSesion, idMiembroComite, tipoDecision, motivo }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idCaso', sql.Int, idCasoSesion)
    .input('idMiembro', sql.Int, idMiembroComite)
    .input('tipo', sql.VarChar(20), tipoDecision)
    .input('motivo', sql.NVarChar(600), motivo || null)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.VotosComite WHERE IdCasoSesion = @idCaso AND IdMiembroComite = @idMiembro)
        UPDATE dbo.VotosComite SET TipoDecision = @tipo, Motivo = @motivo,
          FechaVoto = SYSUTCDATETIME()
        WHERE IdCasoSesion = @idCaso AND IdMiembroComite = @idMiembro;
      ELSE
        INSERT INTO dbo.VotosComite (IdCasoSesion, IdMiembroComite, TipoDecision, Motivo)
        VALUES (@idCaso, @idMiembro, @tipo, @motivo);
    `);
}

export async function cerrarSesionTransaccion(idSesionComite, decisionesGrupo, idUsuario) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const casos = await transaccion.request().input('id', sql.Int, idSesionComite).query(`
      SELECT cs.IdCasoSesion, cs.IdExpediente, e.IdSolicitud, s.IdUsuario,
        tb.PorcentajeCobertura
      FROM dbo.CasosSesionComite cs
      JOIN dbo.Expedientes e ON e.IdExpediente = cs.IdExpediente
      JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
      JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
      JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
      WHERE cs.IdSesionComite = @id
    `);

    const resoluciones = [];
    for (const caso of casos.recordset) {
      const acuerdo = decisionesGrupo.find((item) => item.idCasoSesion === caso.IdCasoSesion);
      if (!acuerdo) throw new Error('SESION_INCOMPLETA');
      await transaccion.request().input('id', sql.Int, caso.IdCasoSesion)
        .query('UPDATE dbo.DecisionesComite SET Vigente = 0 WHERE IdCasoSesion = @id AND Vigente = 1');
      const porcentaje = ['APROBADA', 'CONDICIONADA'].includes(acuerdo.tipoDecision)
        ? Number(caso.PorcentajeCobertura)
        : null;
      const decision = await transaccion.request()
        .input('idCaso', sql.Int, caso.IdCasoSesion)
        .input('tipo', sql.VarChar(20), acuerdo.tipoDecision)
        .input('motivo', sql.NVarChar(600), acuerdo.motivo)
        .input('idUsuario', sql.Int, idUsuario)
        .query(`
          INSERT INTO dbo.DecisionesComite
            (IdCasoSesion, TipoDecision, PorcentajeBeca, Motivo, IdRegistradoPor, EsGrupal)
          OUTPUT INSERTED.IdDecision
          VALUES (@idCaso, @tipo, NULL, @motivo, @idUsuario, 1)
        `);
      const idDecision = decision.recordset[0].IdDecision;
      const numeroResolucion = `RES-${caso.IdExpediente}-${Date.now().toString().slice(-6)}`;
      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('idDecision', sql.Int, idDecision)
        .input('numero', sql.NVarChar(40), numeroResolucion)
        .input('tipo', sql.VarChar(20), acuerdo.tipoDecision)
        .input('porcentaje', sql.Decimal(5, 2), porcentaje)
        .input('motivo', sql.NVarChar(600), acuerdo.motivo)
        .query(`
          INSERT INTO dbo.ResolucionesBeca
            (IdExpediente, IdDecision, NumeroResolucion, TipoResultado, PorcentajeBeca, Motivo, Publicada)
          VALUES (@idExpediente, @idDecision, @numero, @tipo, @porcentaje, @motivo, 1)
        `);
      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('estado', sql.VarChar(30), acuerdo.tipoDecision)
        .query('UPDATE dbo.Expedientes SET Estado = @estado, FechaCierre = SYSUTCDATETIME() WHERE IdExpediente = @idExpediente');
      await transaccion.request()
        .input('idSolicitud', sql.Int, caso.IdSolicitud)
        .input('estado', sql.VarChar(30), acuerdo.tipoDecision)
        .query('UPDATE dbo.Solicitudes SET Estado = @estado, FechaActualizacion = SYSUTCDATETIME() WHERE IdSolicitud = @idSolicitud');
      await transaccion.request()
        .input('idExpediente', sql.Int, caso.IdExpediente)
        .input('estado', sql.VarChar(30), acuerdo.tipoDecision)
        .input('idUsuario', sql.Int, idUsuario)
        .query(`
          INSERT INTO dbo.HistorialEstadosExpediente
            (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
          VALUES (@idExpediente, 'EN_COMITE', @estado, @idUsuario, 'Resolucion grupal publicada por el comite.')
        `);
      await transaccion.request().input('id', sql.Int, caso.IdCasoSesion)
        .query("UPDATE dbo.CasosSesionComite SET Estado = 'DECIDIDO' WHERE IdCasoSesion = @id");
      resoluciones.push({
        idUsuario: caso.IdUsuario,
        idSolicitud: caso.IdSolicitud,
        tipoResultado: acuerdo.tipoDecision,
        numeroResolucion
      });
    }

    await transaccion.request().input('id', sql.Int, idSesionComite)
      .query("UPDATE dbo.SesionesComite SET Estado = 'CERRADA', FechaCierre = SYSUTCDATETIME() WHERE IdSesionComite = @id");
    await transaccion.request().input('id', sql.Int, idSesionComite)
      .input('numero', sql.NVarChar(40), `ACTA-${idSesionComite}`).query(`
        INSERT INTO dbo.ActasComite (IdSesionComite, NumeroActa, Contenido)
        SELECT s.IdSesionComite, @numero,
          CONCAT(N'Sesion: ', s.Nombre, CHAR(10), N'Decision grupal con ',
            (SELECT COUNT(*) FROM dbo.MiembrosSesionComite ms WHERE ms.IdSesionComite = s.IdSesionComite),
            N' integrantes.', CHAR(10), N'Resultados publicados: ',
            (SELECT COUNT(*) FROM dbo.CasosSesionComite cs WHERE cs.IdSesionComite = s.IdSesionComite))
        FROM dbo.SesionesComite s
        WHERE s.IdSesionComite = @id
          AND NOT EXISTS (SELECT 1 FROM dbo.ActasComite a WHERE a.IdSesionComite = s.IdSesionComite)
      `);
    await transaccion.commit();
    return resoluciones;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}
