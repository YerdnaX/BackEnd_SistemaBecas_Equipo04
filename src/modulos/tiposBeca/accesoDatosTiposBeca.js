import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function listarTiposBeca({ soloActivos = false } = {}) {
  const pool = await obtenerPool();
  const filtro = soloActivos ? 'WHERE Activo = 1' : '';
  const resultado = await pool.request().query(`
    SELECT * FROM dbo.TiposBeca ${filtro} ORDER BY Nombre
  `);
  return resultado.recordset;
}

export async function obtenerTipoBecaPorId(idTipoBeca) {
  const pool = await obtenerPool();
  const tipoBeca = await pool.request()
    .input('id', sql.Int, idTipoBeca)
    .query('SELECT * FROM dbo.TiposBeca WHERE IdTipoBeca = @id');
  if (!tipoBeca.recordset[0]) return null;

  const rubros = await pool.request()
    .input('id', sql.Int, idTipoBeca)
    .query('SELECT * FROM dbo.RubrosCobertura WHERE IdTipoBeca = @id AND Activo = 1');

  const criterios = await pool.request()
    .input('id', sql.Int, idTipoBeca)
    .query('SELECT * FROM dbo.CriteriosElegibilidad WHERE IdTipoBeca = @id AND Activo = 1');

  return { ...tipoBeca.recordset[0], rubros: rubros.recordset, criterios: criterios.recordset };
}

export async function crearTipoBeca({ nombre, descripcion, porcentajeCobertura, rubros = [], criterios = [] }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('nombre', sql.NVarChar(150), nombre)
      .input('descripcion', sql.NVarChar(500), descripcion || null)
      .input('porcentaje', sql.Decimal(5, 2), porcentajeCobertura)
      .query(`
        INSERT INTO dbo.TiposBeca (Nombre, Descripcion, PorcentajeCobertura)
        OUTPUT INSERTED.IdTipoBeca
        VALUES (@nombre, @descripcion, @porcentaje)
      `);
    const idTipoBeca = resultado.recordset[0].IdTipoBeca;

    for (const rubro of rubros) {
      await transaccion.request()
        .input('idTipoBeca', sql.Int, idTipoBeca)
        .input('nombre', sql.NVarChar(100), rubro.nombre)
        .input('descripcion', sql.NVarChar(300), rubro.descripcion || null)
        .input('porcentaje', sql.Decimal(5, 2), rubro.porcentaje || 0)
        .query(`
          INSERT INTO dbo.RubrosCobertura (IdTipoBeca, Nombre, Descripcion, Porcentaje)
          VALUES (@idTipoBeca, @nombre, @descripcion, @porcentaje)
        `);
    }

    for (const criterio of criterios) {
      await transaccion.request()
        .input('idTipoBeca', sql.Int, idTipoBeca)
        .input('nombre', sql.NVarChar(150), criterio.nombre)
        .input('descripcion', sql.NVarChar(400), criterio.descripcion || null)
        .input('obligatorio', sql.Bit, criterio.obligatorio !== false)
        .query(`
          INSERT INTO dbo.CriteriosElegibilidad (IdTipoBeca, Nombre, Descripcion, Obligatorio)
          VALUES (@idTipoBeca, @nombre, @descripcion, @obligatorio)
        `);
    }

    await transaccion.commit();
    return idTipoBeca;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function actualizarTipoBeca(idTipoBeca, { nombre, descripcion, porcentajeCobertura, rubros = [], criterios = [] }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request()
      .input('id', sql.Int, idTipoBeca)
      .input('nombre', sql.NVarChar(150), nombre)
      .input('descripcion', sql.NVarChar(500), descripcion || null)
      .input('porcentaje', sql.Decimal(5, 2), porcentajeCobertura)
      .query(`
        UPDATE dbo.TiposBeca SET Nombre = @nombre, Descripcion = @descripcion,
          PorcentajeCobertura = @porcentaje, FechaActualizacion = SYSUTCDATETIME()
        WHERE IdTipoBeca = @id
      `);

    await transaccion.request().input('id', sql.Int, idTipoBeca)
      .query('UPDATE dbo.RubrosCobertura SET Activo = 0 WHERE IdTipoBeca = @id');
    await transaccion.request().input('id', sql.Int, idTipoBeca)
      .query('UPDATE dbo.CriteriosElegibilidad SET Activo = 0 WHERE IdTipoBeca = @id');

    for (const rubro of rubros) {
      await transaccion.request()
        .input('idTipoBeca', sql.Int, idTipoBeca)
        .input('nombre', sql.NVarChar(100), rubro.nombre)
        .input('descripcion', sql.NVarChar(300), rubro.descripcion || null)
        .input('porcentaje', sql.Decimal(5, 2), rubro.porcentaje || 0)
        .query(`
          INSERT INTO dbo.RubrosCobertura (IdTipoBeca, Nombre, Descripcion, Porcentaje)
          VALUES (@idTipoBeca, @nombre, @descripcion, @porcentaje)
        `);
    }

    for (const criterio of criterios) {
      await transaccion.request()
        .input('idTipoBeca', sql.Int, idTipoBeca)
        .input('nombre', sql.NVarChar(150), criterio.nombre)
        .input('descripcion', sql.NVarChar(400), criterio.descripcion || null)
        .input('obligatorio', sql.Bit, criterio.obligatorio !== false)
        .query(`
          INSERT INTO dbo.CriteriosElegibilidad (IdTipoBeca, Nombre, Descripcion, Obligatorio)
          VALUES (@idTipoBeca, @nombre, @descripcion, @obligatorio)
        `);
    }

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function cambiarEstadoTipoBeca(idTipoBeca, activo) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idTipoBeca)
    .input('activo', sql.Bit, activo)
    .query('UPDATE dbo.TiposBeca SET Activo = @activo, FechaActualizacion = SYSUTCDATETIME() WHERE IdTipoBeca = @id');
}

export async function tieneConvocatoriasAsociadas(idTipoBeca) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idTipoBeca)
    .query('SELECT TOP 1 1 AS existe FROM dbo.Convocatorias WHERE IdTipoBeca = @id');
  return resultado.recordset.length > 0;
}
