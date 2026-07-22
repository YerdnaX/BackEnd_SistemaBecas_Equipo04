import { crearAplicacion } from './app.js';
import { configuracion, validarConfiguracionCritica } from './configuracion/variablesEntorno.js';
import { cerrarPool } from './configuracion/baseDatos.js';

validarConfiguracionCritica();

const app = crearAplicacion();

const servidor = app.listen(configuracion.puerto, () => {
  // eslint-disable-next-line no-console
  console.log(`API SGBE escuchando en el puerto ${configuracion.puerto} (${configuracion.entorno}).`);
});

async function apagarOrdenadamente(senial) {
  // eslint-disable-next-line no-console
  console.log(`Señal ${senial} recibida. Cerrando servidor...`);
  servidor.close(async () => {
    await cerrarPool();
    process.exit(0);
  });
}

process.on('SIGINT', () => apagarOrdenadamente('SIGINT'));
process.on('SIGTERM', () => apagarOrdenadamente('SIGTERM'));
