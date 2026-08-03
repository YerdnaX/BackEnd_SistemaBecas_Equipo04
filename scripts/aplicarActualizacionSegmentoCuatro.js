import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';

const directorio = dirname(fileURLToPath(import.meta.url));
const rutaScript = resolve(directorio, '../basedatos/actualizar_segmento_04.sql');

try {
  const contenido = await readFile(rutaScript, 'utf8');
  const lotes = contenido
    .split(/^\s*GO\s*$/gim)
    .map((lote) => lote.trim())
    .filter(Boolean);
  const pool = await obtenerPool();

  for (let indice = 0; indice < lotes.length; indice += 1) {
    try {
      await pool.request().batch(lotes[indice]);
    } catch (error) {
      error.message = `Fallo en el lote ${indice + 1}/${lotes.length}: ${error.message}`;
      throw error;
    }
  }

  console.log(`Actualizacion del Segmento 04 aplicada (${lotes.length} lotes).`);
} finally {
  await cerrarPool();
}
