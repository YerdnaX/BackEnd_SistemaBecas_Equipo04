import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

// --- Parametros (dbo.ConfiguracionesSistema) ---

export async function listarParametros() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query('SELECT * FROM dbo.ConfiguracionesSistema ORDER BY Clave');
  return resultado.recordset;
}

export async function obtenerParametroPorClave(clave) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('clave', sql.NVarChar(80), clave)
    .query('SELECT * FROM dbo.ConfiguracionesSistema WHERE Clave = @clave');
  return resultado.recordset[0] || null;
}

export async function actualizarParametro(clave, valor) {
  const pool = await obtenerPool();
  await pool.request()
    .input('clave', sql.NVarChar(80), clave)
    .input('valor', sql.NVarChar(400), valor)
    .query(`
      UPDATE dbo.ConfiguracionesSistema
      SET Valor = @valor, FechaActualizacion = SYSUTCDATETIME()
      WHERE Clave = @clave
    `);
}

// --- Plantillas de mensajes (dbo.PlantillasMensajes) ---

export async function listarPlantillas() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query('SELECT * FROM dbo.PlantillasMensajes ORDER BY Codigo');
  return resultado.recordset;
}

export async function obtenerPlantillaPorCodigo(codigo) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('codigo', sql.NVarChar(60), codigo)
    .query('SELECT * FROM dbo.PlantillasMensajes WHERE Codigo = @codigo');
  return resultado.recordset[0] || null;
}

export async function crearPlantilla({ codigo, asunto, contenido }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('codigo', sql.NVarChar(60), codigo)
    .input('asunto', sql.NVarChar(200), asunto)
    .input('contenido', sql.NVarChar(sql.MAX), contenido)
    .query(`
      INSERT INTO dbo.PlantillasMensajes (Codigo, Asunto, Contenido)
      VALUES (@codigo, @asunto, @contenido)
    `);
}

export async function actualizarPlantilla(codigo, { asunto, contenido, activo }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('codigo', sql.NVarChar(60), codigo)
    .input('asunto', sql.NVarChar(200), asunto)
    .input('contenido', sql.NVarChar(sql.MAX), contenido)
    .input('activo', sql.Bit, activo ? 1 : 0)
    .query(`
      UPDATE dbo.PlantillasMensajes
      SET Asunto = @asunto, Contenido = @contenido, Activo = @activo, FechaActualizacion = SYSUTCDATETIME()
      WHERE Codigo = @codigo
    `);
}

// --- Catalogo de tipos de documento (dbo.TiposDocumento) ---

export async function listarTiposDocumento() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query('SELECT * FROM dbo.TiposDocumento ORDER BY Nombre');
  return resultado.recordset;
}

export async function crearTipoDocumento({ codigo, nombre, descripcion }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('codigo', sql.NVarChar(40), codigo)
    .input('nombre', sql.NVarChar(120), nombre)
    .input('descripcion', sql.NVarChar(300), descripcion ?? null)
    .query(`
      INSERT INTO dbo.TiposDocumento (Codigo, Nombre, Descripcion)
      VALUES (@codigo, @nombre, @descripcion)
    `);
}

export async function actualizarTipoDocumento(idTipoDocumento, { nombre, descripcion, activo }) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idTipoDocumento)
    .input('nombre', sql.NVarChar(120), nombre)
    .input('descripcion', sql.NVarChar(300), descripcion ?? null)
    .input('activo', sql.Bit, activo ? 1 : 0)
    .query(`
      UPDATE dbo.TiposDocumento SET Nombre = @nombre, Descripcion = @descripcion, Activo = @activo
      WHERE IdTipoDocumento = @id
    `);
}
