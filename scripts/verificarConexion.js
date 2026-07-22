import { obtenerPool, cerrarPool } from '../src/configuracion/baseDatos.js';

try {
  const pool = await obtenerPool();
  await pool.request().query('SELECT 1 AS ok');
  console.log('Conexión a SQL Server exitosa.');
  process.exitCode = 0;
} catch {
  console.error('No fue posible conectar a SQL Server. Verifique las variables de entorno DB_* en BackEnd/.env.');
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
