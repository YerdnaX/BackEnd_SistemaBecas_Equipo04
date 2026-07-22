import { obtenerPool, sql } from '../configuracion/baseDatos.js';
import { configuracion } from '../configuracion/variablesEntorno.js';
import { errorValidacion, errorNoEncontrado } from '../utilidades/errorAplicacion.js';

const EXTENSIONES_PERMITIDAS = configuracion.archivos.extensionesPermitidas;
const TAMANO_MAXIMO_BYTES = configuracion.archivos.tamanoMaximoMb * 1024 * 1024;

export function validarArchivoCargado({ nombreOriginal, tipoMime, tamanoBytes }) {
  const extension = (nombreOriginal.split('.').pop() || '').toLowerCase();

  if (!extension || !EXTENSIONES_PERMITIDAS.includes(extension)) {
    throw errorValidacion('El archivo tiene una extensión no permitida.', [
      { campo: 'archivo', mensaje: `Extensiones permitidas: ${EXTENSIONES_PERMITIDAS.join(', ')}.` }
    ]);
  }

  const mimePermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!mimePermitidos.includes(tipoMime)) {
    throw errorValidacion('El tipo de archivo no es válido.', [
      { campo: 'archivo', mensaje: 'Solo se permiten archivos PDF, JPG o PNG.' }
    ]);
  }

  if (tamanoBytes > TAMANO_MAXIMO_BYTES) {
    throw errorValidacion('El archivo supera el tamaño máximo permitido.', [
      { campo: 'archivo', mensaje: `Tamaño máximo: ${configuracion.archivos.tamanoMaximoMb} MB.` }
    ]);
  }

  return extension;
}

export async function guardarArchivo({ nombreOriginal, tipoMime, contenido }) {
  const extension = validarArchivoCargado({ nombreOriginal, tipoMime, tamanoBytes: contenido.length });
  const nombreInterno = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('nombreOriginal', sql.NVarChar(255), nombreOriginal)
    .input('nombreInterno', sql.NVarChar(255), nombreInterno)
    .input('tipoMime', sql.NVarChar(120), tipoMime)
    .input('extension', sql.VarChar(10), extension)
    .input('tamanoBytes', sql.BigInt, contenido.length)
    .input('contenido', sql.VarBinary(sql.MAX), contenido)
    .query(`
      INSERT INTO dbo.Archivos (NombreOriginal, NombreInterno, TipoMime, Extension, TamanoBytes, Contenido)
      OUTPUT INSERTED.IdArchivo
      VALUES (@nombreOriginal, @nombreInterno, @tipoMime, @extension, @tamanoBytes, @contenido)
    `);

  return resultado.recordset[0].IdArchivo;
}

export async function obtenerArchivo(idArchivo) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idArchivo', sql.Int, idArchivo)
    .query(`
      SELECT IdArchivo, NombreOriginal, TipoMime, Extension, TamanoBytes, Contenido, UrlExterna, Activo
      FROM dbo.Archivos WHERE IdArchivo = @idArchivo
    `);

  const archivo = resultado.recordset[0];
  if (!archivo || !archivo.Activo) {
    throw errorNoEncontrado('El archivo solicitado no existe.');
  }
  return archivo;
}

export async function eliminarArchivoLogico(idArchivo) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idArchivo', sql.Int, idArchivo)
    .query('UPDATE dbo.Archivos SET Activo = 0 WHERE IdArchivo = @idArchivo');
}
