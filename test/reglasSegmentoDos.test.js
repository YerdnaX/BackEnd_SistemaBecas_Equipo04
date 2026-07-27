import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluarPermanencia,
  filtrarActualizacionesExpediente,
  normalizarEstadoConsulta,
  obtenerPaginacion,
  validarProgramacionVisita,
  validarEnvioRenovacion,
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

test('una renovacion enviada exige declaracion y documento', () => {
  assert.throws(
    () => validarEnvioRenovacion({ estado: 'BORRADOR', enviar: true, datosActualizados: {}, cantidadDocumentos: 1 }),
    /declaracion/
  );
  assert.throws(
    () => validarEnvioRenovacion({ estado: 'BORRADOR', enviar: true, datosActualizados: { declaracion: true }, cantidadDocumentos: 0 }),
    /documento/
  );
  assert.deepEqual(
    validarEnvioRenovacion({ estado: 'BORRADOR', enviar: true, datosActualizados: { declaracion: true }, cantidadDocumentos: 1 }),
    { idempotente: false }
  );
});

test('reenviar una renovacion ya enviada es idempotente y no permite editarla', () => {
  assert.deepEqual(
    validarEnvioRenovacion({ estado: 'EN_REEVALUACION', enviar: true }),
    { idempotente: true }
  );
  assert.throws(
    () => validarEnvioRenovacion({ estado: 'EN_REEVALUACION', enviar: false }),
    /borrador/
  );
  assert.throws(
    () => validarEnvioRenovacion({ estado: 'RESUELTA', enviar: true }),
    /borrador/
  );
});

test('el estado visible EN_ATENCION se normaliza al estado persistido', () => {
  assert.equal(normalizarEstadoConsulta('EN_ATENCION'), 'RESPONDIDA');
  assert.equal(normalizarEstadoConsulta('CERRADA'), 'CERRADA');
  assert.throws(() => normalizarEstadoConsulta('DESCONOCIDA'), /estado/);
});
