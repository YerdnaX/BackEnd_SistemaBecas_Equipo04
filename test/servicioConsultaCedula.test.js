import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuracion } from '../src/configuracion/variablesEntorno.js';
import { consultarCedula } from '../src/servicios-compartidos/servicioConsultaCedula.js';

const CEDULA = '118970123';

function conFetchSimulado(fetchSimulado, prueba) {
  const fetchOriginal = global.fetch;
  const apiKeyOriginal = configuracion.consultaCedula.apiKey;
  global.fetch = fetchSimulado;
  configuracion.consultaCedula.apiKey = 'clave-de-prueba';
  return prueba().finally(() => {
    global.fetch = fetchOriginal;
    configuracion.consultaCedula.apiKey = apiKeyOriginal;
  });
}

test('consultarCedula responde 503 sin exponer detalles cuando no hay API key configurada', async () => {
  const apiKeyOriginal = configuracion.consultaCedula.apiKey;
  configuracion.consultaCedula.apiKey = '';
  try {
    await assert.rejects(
      () => consultarCedula(CEDULA),
      (error) => {
        assert.equal(error.estadoHttp, 503);
        assert.equal(error.codigo, 'CONSULTA_CEDULA_NO_CONFIGURADA');
        return true;
      }
    );
  } finally {
    configuracion.consultaCedula.apiKey = apiKeyOriginal;
  }
});

test('consultarCedula devuelve nombre y apellidos separados cuando el proveedor responde con éxito', async () => {
  await conFetchSimulado(
    async () => ({ ok: true, status: 200, json: async () => ({ nombre: 'Juan Carlos Pérez Gómez' }) }),
    async () => {
      const resultado = await consultarCedula(CEDULA);
      assert.deepEqual(resultado, { nombre: 'Juan Carlos', primerApellido: 'Pérez', segundoApellido: 'Gómez' });
    }
  );
});

test('consultarCedula lanza NO_ENCONTRADO cuando el proveedor responde 404', async () => {
  await conFetchSimulado(
    async () => ({ ok: false, status: 404, json: async () => null }),
    () => assert.rejects(
      () => consultarCedula(CEDULA),
      (error) => {
        assert.equal(error.estadoHttp, 404);
        assert.equal(error.codigo, 'NO_ENCONTRADO');
        return true;
      }
    )
  );
});

test('consultarCedula no expone el error técnico cuando falla la conexión', async () => {
  await conFetchSimulado(
    async () => { throw new Error('ECONNRESET detalle interno de red'); },
    () => assert.rejects(
      () => consultarCedula(CEDULA),
      (error) => {
        assert.equal(error.estadoHttp, 503);
        assert.equal(error.codigo, 'CONSULTA_CEDULA_SIN_CONEXION');
        assert.doesNotMatch(error.message, /ECONNRESET/);
        return true;
      }
    )
  );
});
