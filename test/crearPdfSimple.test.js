import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPdfSimple, prepararLineasPdf } from '../src/utilidades/crearPdfSimple.js';

test('crearPdfSimple genera un documento PDF reconocible', () => {
  const documento = crearPdfSimple(['SGBE - CUC', 'Acta de prueba']);
  assert.equal(documento.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.match(documento.toString('ascii'), /Acta de prueba/);
  assert.match(documento.toString('ascii'), /%%EOF$/);
});

test('prepararLineasPdf separa saltos y ajusta texto largo al ancho', () => {
  const lineas = prepararLineasPdf([
    'Primera condicion.&&Segunda condicion.',
    'Una linea deliberadamente extensa para comprobar que el contenido se divide sin salirse del ancho disponible.'
  ], 35);

  assert.deepEqual(lineas.slice(0, 2), ['Primera condicion.', 'Segunda condicion.']);
  assert.ok(lineas.every((linea) => linea.length <= 35));
  assert.ok(lineas.length > 3);
});
