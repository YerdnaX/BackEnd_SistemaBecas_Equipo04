import test from 'node:test';
import assert from 'node:assert/strict';
import { requiereAlgunPermiso, requierePermiso } from '../src/middleware/autorizacion.js';

function ejecutar(middleware, permisos) {
  let siguiente = false;
  middleware({ usuario: { permisos } }, {}, () => { siguiente = true; });
  return siguiente;
}

test('requierePermiso permite solamente el permiso solicitado', () => {
  assert.equal(ejecutar(requierePermiso('REPORTE_VER'), ['REPORTE_VER']), true);
  assert.throws(() => ejecutar(requierePermiso('REPORTE_VER'), ['ACTA_VER']), /permiso/);
});

test('requiereAlgunPermiso admite roles personalizados por capacidad', () => {
  const middleware = requiereAlgunPermiso(
    'ACTIVACION_FINANCIERA_GESTIONAR',
    'VALIDACION_ACADEMICA_GESTIONAR',
    'SEGUIMIENTO_GESTIONAR'
  );
  assert.equal(ejecutar(middleware, ['SEGUIMIENTO_GESTIONAR']), true);
  assert.throws(() => ejecutar(middleware, ['REPORTE_VER']), /permiso/);
});
