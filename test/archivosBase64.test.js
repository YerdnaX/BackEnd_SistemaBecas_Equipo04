import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodificarArchivoBase64 } from '../src/utilidades/archivosBase64.js';
import { ErrorAplicacion } from '../src/utilidades/errorAplicacion.js';

test('decodificarArchivoBase64 decodifica una URL de datos base64', () => {
  const buffer = decodificarArchivoBase64('data:text/plain;base64,SG9sYQ==');
  assert.equal(buffer.toString('utf8'), 'Hola');
});

test('decodificarArchivoBase64 rechaza valores vacíos', () => {
  assert.throws(() => decodificarArchivoBase64(''), ErrorAplicacion);
  assert.throws(() => decodificarArchivoBase64(null), ErrorAplicacion);
});
