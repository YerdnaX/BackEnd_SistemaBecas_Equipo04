import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPuntajePonderado, calcularPuntajeTotal } from '../src/utilidades/calculoEvaluacion.js';

test('calcularPuntajePonderado aplica puntaje * porcentaje / 100', () => {
  assert.equal(calcularPuntajePonderado(80, 40), 32);
  assert.equal(calcularPuntajePonderado(100, 20), 20);
  assert.equal(calcularPuntajePonderado(0, 40), 0);
});

test('calcularPuntajeTotal suma los puntajes ponderados de todos los componentes', () => {
  const total = calcularPuntajeTotal([
    calcularPuntajePonderado(80, 40),
    calcularPuntajePonderado(70, 40),
    calcularPuntajePonderado(90, 20)
  ]);
  assert.equal(total, 32 + 28 + 18);
});
