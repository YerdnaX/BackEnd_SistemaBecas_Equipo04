import { obtenerPool, sql } from '../configuracion/baseDatos.js';

const cacheParametros = new Map();
const DURACION_CACHE_MS = 30 * 1000;

export async function obtenerParametro(clave, valorPorDefecto = null) {
  const entradaCache = cacheParametros.get(clave);
  if (entradaCache && Date.now() - entradaCache.fecha < DURACION_CACHE_MS) {
    return entradaCache.valor;
  }

  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('clave', sql.NVarChar(80), clave)
    .query('SELECT Valor, TipoDato FROM dbo.ConfiguracionesSistema WHERE Clave = @clave AND Activo = 1');

  const fila = resultado.recordset[0];
  if (!fila) return valorPorDefecto;

  let valor = fila.Valor;
  if (fila.TipoDato === 'NUMERO') valor = Number(fila.Valor);
  if (fila.TipoDato === 'BOOLEANO') valor = fila.Valor === 'true';

  cacheParametros.set(clave, { valor, fecha: Date.now() });
  return valor;
}

export function invalidarCacheParametros() {
  cacheParametros.clear();
}
