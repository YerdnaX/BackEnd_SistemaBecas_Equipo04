import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function buscarPreguntas(termino, limite) {
  const pool = await obtenerPool();
  const patron = `%${termino}%`;
  const resultado = await pool.request()
    .input('patron', sql.NVarChar(320), patron)
    .input('limite', sql.Int, limite)
    .query(`
      SELECT TOP (@limite) IdPreguntaRespuesta, Pregunta, Respuesta, Categoria
      FROM dbo.PreguntasRespuestasChatbot
      WHERE Activo = 1 AND (
        Pregunta LIKE @patron OR PalabrasClave LIKE @patron OR Categoria LIKE @patron
      )
      ORDER BY
        CASE WHEN Pregunta LIKE @patron THEN 0 ELSE 1 END,
        FechaActualizacion DESC
    `);
  return resultado.recordset;
}

export async function listarCategorias() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT DISTINCT Categoria FROM dbo.PreguntasRespuestasChatbot
    WHERE Activo = 1 AND Categoria IS NOT NULL ORDER BY Categoria
  `);
  return resultado.recordset.map((fila) => fila.Categoria);
}

export async function listarEntradas({ categoria, soloActivas = false } = {}) {
  const pool = await obtenerPool();
  const solicitud = pool.request();
  const condiciones = [];
  if (categoria) { solicitud.input('categoria', sql.NVarChar(80), categoria); condiciones.push('Categoria = @categoria'); }
  if (soloActivas) condiciones.push('Activo = 1');
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const resultado = await solicitud.query(`SELECT * FROM dbo.PreguntasRespuestasChatbot ${filtro} ORDER BY Categoria, Pregunta`);
  return resultado.recordset;
}

export async function obtenerEntradaPorId(id) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM dbo.PreguntasRespuestasChatbot WHERE IdPreguntaRespuesta = @id');
  return resultado.recordset[0] || null;
}

export async function crearEntrada({ pregunta, respuesta, categoria, palabrasClave, idAutor }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('pregunta', sql.NVarChar(300), pregunta)
    .input('respuesta', sql.NVarChar(1000), respuesta)
    .input('categoria', sql.NVarChar(80), categoria ?? null)
    .input('palabrasClave', sql.NVarChar(300), palabrasClave ?? null)
    .input('idAutor', sql.Int, idAutor ?? null)
    .query(`
      INSERT INTO dbo.PreguntasRespuestasChatbot (Pregunta, Respuesta, Categoria, PalabrasClave, IdAutor)
      OUTPUT INSERTED.IdPreguntaRespuesta
      VALUES (@pregunta, @respuesta, @categoria, @palabrasClave, @idAutor)
    `);
  return resultado.recordset[0].IdPreguntaRespuesta;
}

export async function actualizarEntrada(id, { pregunta, respuesta, categoria, palabrasClave, activo }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('pregunta', sql.NVarChar(300), pregunta)
    .input('respuesta', sql.NVarChar(1000), respuesta)
    .input('categoria', sql.NVarChar(80), categoria ?? null)
    .input('palabrasClave', sql.NVarChar(300), palabrasClave ?? null)
    .input('activo', sql.Bit, activo ? 1 : 0)
    .query(`
      UPDATE dbo.PreguntasRespuestasChatbot
      SET Pregunta = @pregunta, Respuesta = @respuesta, Categoria = @categoria,
          PalabrasClave = @palabrasClave, Activo = @activo, FechaActualizacion = SYSUTCDATETIME()
      WHERE IdPreguntaRespuesta = @id
    `);
}

export async function eliminarEntrada(id) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE dbo.PreguntasRespuestasChatbot SET Activo = 0, FechaActualizacion = SYSUTCDATETIME() WHERE IdPreguntaRespuesta = @id');
}
