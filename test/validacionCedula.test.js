import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFormatoCedula } from '../src/servicios-compartidos/servicioConsultaCedula.js';

test('validarFormatoCedula acepta una cédula de 9 dígitos', () => {
  assert.equal(validarFormatoCedula('118970123'), '118970123');
});

test('validarFormatoCedula normaliza guiones y espacios antes de validar', () => {
  assert.equal(validarFormatoCedula('1-1897-0123'), '118970123');
  assert.equal(validarFormatoCedula(' 118970123 '), '118970123');
});

test('validarFormatoCedula rechaza cédulas con letras', () => {
  assert.throws(() => validarFormatoCedula('11897012A'), /9 dígitos/);
});

test('validarFormatoCedula rechaza cédulas incompletas', () => {
  assert.throws(() => validarFormatoCedula('1189701'), /9 dígitos/);
});

test('validarFormatoCedula rechaza cédulas con más de 9 dígitos', () => {
  assert.throws(() => validarFormatoCedula('1189701234'), /9 dígitos/);
});

test('validarFormatoCedula rechaza valores vacíos', () => {
  assert.throws(() => validarFormatoCedula(''), /9 dígitos/);
  assert.throws(() => validarFormatoCedula(undefined), /9 dígitos/);
});
