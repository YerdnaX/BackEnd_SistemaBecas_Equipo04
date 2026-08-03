import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMateriasNotas, calcularPromedioNotas } from '../src/utilidades/notasSimuladas.js';

test('calcularPromedioNotas calcula correctamente el promedio de varias materias', () => {
  const materias = [
    { nombreMateria: 'Matemática', nota: 90, periodo: 'I Cuatrimestre 2026' },
    { nombreMateria: 'Español', nota: 80, periodo: 'I Cuatrimestre 2026' },
    { nombreMateria: 'Inglés', nota: 100, periodo: 'I Cuatrimestre 2026' }
  ];
  assert.equal(calcularPromedioNotas(materias), 90);
});

test('calcularPromedioNotas redondea a 2 decimales', () => {
  const materias = [
    { nombreMateria: 'Matemática', nota: 90, periodo: 'I' },
    { nombreMateria: 'Español', nota: 85, periodo: 'I' },
    { nombreMateria: 'Inglés', nota: 70, periodo: 'I' }
  ];
  assert.equal(calcularPromedioNotas(materias), 81.67);
});

test('validarMateriasNotas rechaza una nota fuera de 0-100', () => {
  const errores = validarMateriasNotas([{ nombreMateria: 'Física', nota: 150, periodo: 'I' }]);
  assert.ok(errores.some((e) => e.campo.includes('nota')));
});

test('validarMateriasNotas rechaza una nota negativa', () => {
  const errores = validarMateriasNotas([{ nombreMateria: 'Física', nota: -5, periodo: 'I' }]);
  assert.ok(errores.some((e) => e.campo.includes('nota')));
});

test('validarMateriasNotas rechaza una materia sin nombre', () => {
  const errores = validarMateriasNotas([{ nombreMateria: '', nota: 80, periodo: 'I' }]);
  assert.ok(errores.some((e) => e.campo.includes('nombreMateria')));
});

test('validarMateriasNotas rechaza una lista vacía', () => {
  const errores = validarMateriasNotas([]);
  assert.equal(errores.length, 1);
  assert.equal(errores[0].campo, 'materias');
});

test('validarMateriasNotas acepta una lista válida', () => {
  const errores = validarMateriasNotas([{ nombreMateria: 'Química', nota: 95, periodo: 'II Cuatrimestre 2026' }]);
  assert.equal(errores.length, 0);
});
