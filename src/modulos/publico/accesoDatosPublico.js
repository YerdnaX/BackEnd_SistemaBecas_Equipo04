import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

const CAMPOS_CONVOCATORIA_PUBLICA = `
  c.IdConvocatoria, c.Nombre, c.Descripcion, c.FechaInicio, c.FechaFin, c.Cupos,
  c.Estado, tb.IdTipoBeca, tb.Nombre AS NombreTipoBeca, tb.PorcentajeCobertura
`;

export async function listarConvocatoriasPublicadas({ limite } = {}) {
  const pool = await obtenerPool();
  const solicitud = pool.request();
  const topSql = limite ? `TOP ${Number(limite)}` : '';
  const resultado = await solicitud.query(`
    SELECT ${topSql} ${CAMPOS_CONVOCATORIA_PUBLICA}
    FROM dbo.Convocatorias c JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
    WHERE c.Estado = 'PUBLICADA' AND c.FechaFin >= SYSUTCDATETIME()
    ORDER BY c.FechaFin ASC
  `);
  return resultado.recordset;
}

export async function obtenerConvocatoriaPublicaPorId(idConvocatoria) {
  const pool = await obtenerPool();
  const convocatoria = await pool.request()
    .input('id', sql.Int, idConvocatoria)
    .query(`
      SELECT ${CAMPOS_CONVOCATORIA_PUBLICA}
      FROM dbo.Convocatorias c JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = c.IdTipoBeca
      WHERE c.IdConvocatoria = @id AND c.Estado = 'PUBLICADA' AND c.FechaFin >= SYSUTCDATETIME()
    `);
  if (!convocatoria.recordset[0]) return null;

  const requisitos = await pool.request()
    .input('id', sql.Int, idConvocatoria)
    .query('SELECT Nombre, Descripcion, Obligatorio FROM dbo.RequisitosConvocatoria WHERE IdConvocatoria = @id AND Activo = 1');

  return { ...convocatoria.recordset[0], requisitos: requisitos.recordset };
}

/**
 * Devuelve el cuatrimestre (periodo) actualmente activo, si existe uno cuya
 * ventana de fechas cubre el momento presente. Se reutiliza el mismo
 * catalogo de PeriodosRenovacion que usa el segmento de renovaciones, para
 * no duplicar el concepto de "cuatrimestre actual" en dos tablas distintas.
 */
export async function obtenerCuatrimestreActual() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT TOP 1 IdPeriodoRenovacion, Periodo, FechaInicio, FechaFin
    FROM dbo.PeriodosRenovacion
    WHERE Activo = 1 AND SYSUTCDATETIME() BETWEEN FechaInicio AND FechaFin
    ORDER BY FechaInicio DESC
  `);
  return resultado.recordset[0] || null;
}

export async function listarNoticiasPublicadas({ limite, categoria, soloCuatrimestreActual } = {}) {
  const pool = await obtenerPool();
  const topSql = limite ? `TOP ${Number(limite)}` : '';
  const solicitud = pool.request();

  let filtroCategoria = '';
  if (categoria) {
    solicitud.input('categoria', sql.VarChar(20), categoria);
    filtroCategoria = 'AND Categoria = @categoria';
  }

  let filtroCuatrimestre = '';
  if (soloCuatrimestreActual) {
    const cuatrimestre = await obtenerCuatrimestreActual();
    if (cuatrimestre) {
      solicitud.input('inicioCuatrimestre', sql.DateTime2, cuatrimestre.FechaInicio);
      solicitud.input('finCuatrimestre', sql.DateTime2, cuatrimestre.FechaFin);
      filtroCuatrimestre = 'AND FechaPublicacion BETWEEN @inicioCuatrimestre AND @finCuatrimestre';
    }
  }

  const resultado = await solicitud.query(`
    SELECT ${topSql} IdNoticia, Titulo, Contenido, PublicoDestino, Categoria, FechaPublicacion
    FROM dbo.Noticias
    WHERE Estado = 'PUBLICADA' AND PublicoDestino IN ('GENERAL','TODOS')
      AND FechaPublicacion <= SYSUTCDATETIME()
      ${filtroCategoria}
      ${filtroCuatrimestre}
    ORDER BY FechaPublicacion DESC
  `);
  return resultado.recordset;
}
