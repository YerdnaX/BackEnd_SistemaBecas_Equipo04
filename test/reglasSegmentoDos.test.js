import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluarPermanencia,
  filtrarActualizacionesExpediente,
  obtenerPaginacion,
  validarProgramacionVisita,
  validarResultadoRenovacion
} from '../src/utilidades/reglasSegmentoDos.js';

test('el expediente solo acepta campos permitidos', () => {
  assert.deepEqual(
    filtrarActualizacionesExpediente({ telefono: '8888-8888', identificacion: 'no editable' }),
    { telefono: '8888-8888' }
  );
});

test('una visita no puede programarse en el pasado', () => {
  assert.throws(
    () => validarProgramacionVisita('2026-01-01T10:00:00Z', new Date('2026-07-01T10:00:00Z')),
    /fecha futura/
  );
});

test('las reglas de permanencia generan alertas sin suspender la beca', () => {
  assert.deepEqual(
    evaluarPermanencia({ promedio: 65, creditosAprobados: 6 }),
    { cumple: false, motivos: ['PROMEDIO_BAJO', 'CREDITOS_INSUFICIENTES'] }
  );
});

test('una renovacion reducida requiere porcentaje valido', () => {
  assert.throws(() => validarResultadoRenovacion('REDUCIDA', 0), /entre 0 y 100/);
  assert.doesNotThrow(() => validarResultadoRenovacion('REDUCIDA', 50));
});

test('la paginacion limita resultados y normaliza valores', () => {
  assert.deepEqual(obtenerPaginacion({ pagina: '-1', limite: '500' }), {
    pagina: 1,
    limite: 100,
    desplazamiento: 0
  });
});

