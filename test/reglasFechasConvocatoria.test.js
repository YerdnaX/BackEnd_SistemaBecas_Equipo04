import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarVentanaConvocatoria } from '../src/modulos/solicitudes/servicioSolicitudes.js';

function convocatoria(fechaInicio, fechaFin) {
  return { FechaInicio: fechaInicio, FechaFin: fechaFin };
}

test('validarVentanaConvocatoria rechaza una solicitud antes de la apertura', () => {
  const ahora = new Date('2026-06-15T12:00:00Z');
  const conv = convocatoria('2026-07-01T00:00:00Z', '2026-07-31T23:59:00Z');
  assert.throws(() => validarVentanaConvocatoria(conv, ahora), /aún no abre/);
});

test('validarVentanaConvocatoria rechaza una solicitud después del cierre', () => {
  const ahora = new Date('2026-08-01T00:00:01Z');
  const conv = convocatoria('2026-06-01T00:00:00Z', '2026-07-31T23:59:00Z');
  assert.throws(() => validarVentanaConvocatoria(conv, ahora), /ya cerró/);
});

test('validarVentanaConvocatoria permite una solicitud dentro del periodo válido', () => {
  const ahora = new Date('2026-07-15T10:00:00Z');
  const conv = convocatoria('2026-07-01T00:00:00Z', '2026-07-31T23:59:00Z');
  assert.doesNotThrow(() => validarVentanaConvocatoria(conv, ahora));
});

test('validarVentanaConvocatoria distingue la hora, no solo la fecha', () => {
  // La convocatoria cierra el mismo día a las 17:00; a las 18:00 ya cerró.
  const conv = convocatoria('2026-07-01T08:00:00Z', '2026-07-01T17:00:00Z');
  assert.doesNotThrow(() => validarVentanaConvocatoria(conv, new Date('2026-07-01T16:59:00Z')));
  assert.throws(() => validarVentanaConvocatoria(conv, new Date('2026-07-01T18:00:00Z')), /ya cerró/);
});
