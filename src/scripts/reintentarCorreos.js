// Uso: node src/scripts/reintentarCorreos.js
// Pensado para ejecutarse periódicamente (por ejemplo cada 15 minutos)
// mediante un programador de tareas del sistema operativo o un cron job
// del contenedor. No requiere sesión porque corre fuera de Express.
import { reintentarEnviosFallidos } from '../servicios-compartidos/servicioCorreo.js';
import { cerrarPool } from '../configuracion/baseDatos.js';

async function ejecutar() {
  const resultado = await reintentarEnviosFallidos();
  // eslint-disable-next-line no-console
  console.log(`Reintento de correos: ${resultado.reintentados} procesados, ${resultado.exitosos} exitosos, ${resultado.fallidos} siguen fallidos.`);
  await cerrarPool();
  process.exit(0);
}

ejecutar().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('Error al reintentar correos:', error);
  await cerrarPool();
  process.exit(1);
});
