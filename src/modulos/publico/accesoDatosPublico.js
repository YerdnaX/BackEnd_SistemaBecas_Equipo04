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

export async function listarNoticiasPublicadas({ limite } = {}) {
  const pool = await obtenerPool();
  const topSql = limite ? `TOP ${Number(limite)}` : '';
  const resultado = await pool.request().query(`
    SELECT ${topSql} IdNoticia, Titulo, Contenido, PublicoDestino, FechaPublicacion
    FROM dbo.Noticias WHERE Estado = 'PUBLICADA'
    ORDER BY FechaPublicacion DESC
  `);
  return resultado.recordset;
}
