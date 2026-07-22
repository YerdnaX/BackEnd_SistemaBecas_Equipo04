import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

const TIPOS_ETAPA = ['RECEPCION', 'REVISION_DOCUMENTAL', 'EVALUACION', 'COMITE', 'RESULTADOS'];

export async function listarConvocatorias({ estado, idTipoBeca, pagina = 1, tamanoPagina = 20 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (estado) { solicitud.input('estado', sql.VarChar(30), estado); condiciones.push('c.Estado = @estado'); }
  if (idTipoBeca) { solicitud.input('idTipoBeca', sql.Int, idTipoBeca); condiciones.push('c.IdTipoBeca = @idTipoBeca'); }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT c.*, tb.Nombre AS NombreTipoBeca,
      COUNT(*) OVER() AS TotalRegistros
    FROM dbo.Convocatorias c
    JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
    ${filtro}
    ORDER BY c.FechaCreacion DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function obtenerConvocatoriaPorId(idConvocatoria) {
  const pool = await obtenerPool();
  const convocatoria = await pool.request()
    .input('id', sql.Int, idConvocatoria)
    .query(`
      SELECT c.*, tb.Nombre AS NombreTipoBeca
      FROM dbo.Convocatorias c JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
      WHERE c.IdConvocatoria = @id
    `);
  if (!convocatoria.recordset[0]) return null;

  const requisitos = await pool.request()
    .input('id', sql.Int, idConvocatoria)
    .query('SELECT * FROM dbo.RequisitosConvocatoria WHERE IdConvocatoria = @id AND Activo = 1');

  const etapas = await pool.request()
    .input('id', sql.Int, idConvocatoria)
    .query('SELECT * FROM dbo.EtapasConvocatoria WHERE IdConvocatoria = @id ORDER BY IdEtapa');

  return { ...convocatoria.recordset[0], requisitos: requisitos.recordset, etapas: etapas.recordset };
}

export async function crearConvocatoria({ idTipoBeca, nombre, descripcion, fechaInicio, fechaFin, cupos, presupuesto, requisitos = [], idCreadoPor }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('idTipoBeca', sql.Int, idTipoBeca)
      .input('nombre', sql.NVarChar(200), nombre)
      .input('descripcion', sql.NVarChar(1000), descripcion || null)
      .input('fechaInicio', sql.DateTime2, fechaInicio)
      .input('fechaFin', sql.DateTime2, fechaFin)
      .input('cupos', sql.Int, cupos)
      .input('presupuesto', sql.Decimal(12, 2), presupuesto || 0)
      .input('idCreadoPor', sql.Int, idCreadoPor)
      .query(`
        INSERT INTO dbo.Convocatorias (IdTipoBeca, Nombre, Descripcion, FechaInicio, FechaFin, Cupos, Presupuesto, IdCreadoPor)
        OUTPUT INSERTED.IdConvocatoria
        VALUES (@idTipoBeca, @nombre, @descripcion, @fechaInicio, @fechaFin, @cupos, @presupuesto, @idCreadoPor)
      `);
    const idConvocatoria = resultado.recordset[0].IdConvocatoria;

    for (const requisito of requisitos) {
      await transaccion.request()
        .input('idConvocatoria', sql.Int, idConvocatoria)
        .input('nombre', sql.NVarChar(150), requisito.nombre)
        .input('descripcion', sql.NVarChar(400), requisito.descripcion || null)
        .input('idTipoDocumento', sql.Int, requisito.idTipoDocumento || null)
        .input('obligatorio', sql.Bit, requisito.obligatorio !== false)
        .query(`
          INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
          VALUES (@idConvocatoria, @nombre, @descripcion, @idTipoDocumento, @obligatorio)
        `);
    }

    for (const tipoEtapa of TIPOS_ETAPA) {
      await transaccion.request()
        .input('idConvocatoria', sql.Int, idConvocatoria)
        .input('tipoEtapa', sql.VarChar(30), tipoEtapa)
        .input('fechaInicio', sql.DateTime2, fechaInicio)
        .input('fechaFin', sql.DateTime2, fechaFin)
        .query(`
          INSERT INTO dbo.EtapasConvocatoria (IdConvocatoria, TipoEtapa, FechaInicio, FechaFin)
          VALUES (@idConvocatoria, @tipoEtapa, @fechaInicio, @fechaFin)
        `);
    }

    await transaccion.commit();
    return idConvocatoria;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function actualizarConvocatoria(idConvocatoria, { idTipoBeca, nombre, descripcion, fechaInicio, fechaFin, cupos, presupuesto, requisitos = [] }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('id', sql.Int, idConvocatoria)
      .input('idTipoBeca', sql.Int, idTipoBeca)
      .input('nombre', sql.NVarChar(200), nombre)
      .input('descripcion', sql.NVarChar(1000), descripcion || null)
      .input('fechaInicio', sql.DateTime2, fechaInicio)
      .input('fechaFin', sql.DateTime2, fechaFin)
      .input('cupos', sql.Int, cupos)
      .input('presupuesto', sql.Decimal(12, 2), presupuesto || 0)
      .query(`
        UPDATE dbo.Convocatorias SET IdTipoBeca = @idTipoBeca, Nombre = @nombre, Descripcion = @descripcion,
          FechaInicio = @fechaInicio, FechaFin = @fechaFin, Cupos = @cupos, Presupuesto = @presupuesto,
          FechaActualizacion = SYSUTCDATETIME()
        WHERE IdConvocatoria = @id
      `);

    await transaccion.request().input('id', sql.Int, idConvocatoria)
      .query('UPDATE dbo.RequisitosConvocatoria SET Activo = 0 WHERE IdConvocatoria = @id');

    for (const requisito of requisitos) {
      await transaccion.request()
        .input('idConvocatoria', sql.Int, idConvocatoria)
        .input('nombre', sql.NVarChar(150), requisito.nombre)
        .input('descripcion', sql.NVarChar(400), requisito.descripcion || null)
        .input('idTipoDocumento', sql.Int, requisito.idTipoDocumento || null)
        .input('obligatorio', sql.Bit, requisito.obligatorio !== false)
        .query(`
          INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
          VALUES (@idConvocatoria, @nombre, @descripcion, @idTipoDocumento, @obligatorio)
        `);
    }

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function cambiarEstadoConvocatoria(idConvocatoria, estado, idAprobadoPor = null) {
  const pool = await obtenerPool();
  const solicitud = pool.request().input('id', sql.Int, idConvocatoria).input('estado', sql.VarChar(30), estado);
  if (idAprobadoPor) {
    solicitud.input('idAprobadoPor', sql.Int, idAprobadoPor);
    await solicitud.query(`
      UPDATE dbo.Convocatorias SET Estado = @estado, IdAprobadoPor = @idAprobadoPor, FechaActualizacion = SYSUTCDATETIME()
      WHERE IdConvocatoria = @id
    `);
  } else if (estado === 'PUBLICADA') {
    await solicitud.query(`
      UPDATE dbo.Convocatorias SET Estado = @estado, FechaPublicacion = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
      WHERE IdConvocatoria = @id
    `);
  } else {
    await solicitud.query('UPDATE dbo.Convocatorias SET Estado = @estado, FechaActualizacion = SYSUTCDATETIME() WHERE IdConvocatoria = @id');
  }
}

export async function actualizarEtapa(idConvocatoria, idEtapa, { fechaInicio, fechaFin, estado }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idConvocatoria', sql.Int, idConvocatoria)
    .input('idEtapa', sql.Int, idEtapa)
    .input('fechaInicio', sql.DateTime2, fechaInicio)
    .input('fechaFin', sql.DateTime2, fechaFin)
    .input('estado', sql.VarChar(20), estado)
    .query(`
      UPDATE dbo.EtapasConvocatoria SET FechaInicio = @fechaInicio, FechaFin = @fechaFin, Estado = @estado,
        FechaActualizacion = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE IdEtapa = @idEtapa AND IdConvocatoria = @idConvocatoria
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerEtapaPorId(idConvocatoria, idEtapa) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idConvocatoria', sql.Int, idConvocatoria)
    .input('idEtapa', sql.Int, idEtapa)
    .query('SELECT * FROM dbo.EtapasConvocatoria WHERE IdEtapa = @idEtapa AND IdConvocatoria = @idConvocatoria');
  return resultado.recordset[0] || null;
}

export async function registrarHistorialEtapa({ idEtapa, estadoAnterior, estadoNuevo, idUsuario, observacion }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idEtapa', sql.Int, idEtapa)
    .input('estadoAnterior', sql.VarChar(20), estadoAnterior)
    .input('estadoNuevo', sql.VarChar(20), estadoNuevo)
    .input('idUsuario', sql.Int, idUsuario)
    .input('observacion', sql.NVarChar(400), observacion || null)
    .query(`
      INSERT INTO dbo.HistorialEtapasConvocatoria (IdEtapa, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
      VALUES (@idEtapa, @estadoAnterior, @estadoNuevo, @idUsuario, @observacion)
    `);
}

export async function obtenerEtapaAbierta(idConvocatoria, tipoEtapa) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idConvocatoria', sql.Int, idConvocatoria)
    .input('tipoEtapa', sql.VarChar(30), tipoEtapa)
    .query(`
      SELECT TOP 1 * FROM dbo.EtapasConvocatoria
      WHERE IdConvocatoria = @idConvocatoria AND TipoEtapa = @tipoEtapa AND Estado = 'ABIERTA'
    `);
  return resultado.recordset[0] || null;
}
