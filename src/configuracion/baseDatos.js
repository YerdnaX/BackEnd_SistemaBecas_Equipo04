import sql from 'mssql';
import { configuracion } from './variablesEntorno.js';

let poolPromesa = null;

function construirConfiguracionPool() {
  return {
    server: configuracion.baseDatos.servidor,
    port: configuracion.baseDatos.puerto,
    database: configuracion.baseDatos.baseDatos,
    user: configuracion.baseDatos.usuario,
    password: configuracion.baseDatos.contrasena,
    options: {
      encrypt: configuracion.baseDatos.encriptar,
      trustServerCertificate: configuracion.baseDatos.confiarCertificado
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

export function obtenerPool() {
  if (!poolPromesa) {
    poolPromesa = new sql.ConnectionPool(construirConfiguracionPool())
      .connect()
      .catch((error) => {
        poolPromesa = null;
        throw error;
      });
  }
  return poolPromesa;
}

export async function cerrarPool() {
  if (poolPromesa) {
    const pool = await poolPromesa.catch(() => null);
    if (pool) await pool.close();
    poolPromesa = null;
  }
}

export { sql };
