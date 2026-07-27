import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPdfSimple } from '../src/utilidades/crearPdfSimple.js';

test('crearPdfSimple genera un documento PDF reconocible', () => {
  const documento = crearPdfSimple(['SGBE - CUC', 'Acta de prueba']);
  assert.equal(documento.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.match(documento.toString('ascii'), /Acta de prueba/);
  assert.match(documento.toString('ascii'), /%%EOF$/);
});

