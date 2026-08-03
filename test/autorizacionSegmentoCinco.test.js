import test from 'node:test';
import assert from 'node:assert/strict';
import { requierePermiso } from '../src/middleware/autorizacion.js';

function ejecutar(middleware, permisos) {
  let siguiente = false;
  middleware({ usuario: { permisos } }, {}, () => { siguiente = true; });
  return siguiente;
}

// A partir del Segmento 05, la gestión operativa de becas y convocatorias es
// exclusiva de Trabajadora Social; Administrador/Coordinador de Becas
// conservan solo lectura (TIPO_BECA_VER/CONVOCATORIA_VER). Este test verifica
// el efecto de esa reasignación de permisos sobre el middleware de
// autorización (la fuente de la verdad real vive en RolesPermisos, aplicada
// por actualizar_segmento_05.sql).
test('un administrador sin CONVOCATORIA_CREAR queda bloqueado tras el Segmento 05', () => {
  const soloLectura = ['CONVOCATORIA_VER', 'TIPO_BECA_VER'];
  assert.throws(() => ejecutar(requierePermiso('CONVOCATORIA_CREAR'), soloLectura), /permiso/);
});

test('trabajadora social con CONVOCATORIA_CREAR puede gestionar convocatorias', () => {
  const permisosTrabajadoraSocial = ['CONVOCATORIA_VER', 'CONVOCATORIA_CREAR', 'CONVOCATORIA_EDITAR', 'ETAPA_GESTIONAR'];
  assert.equal(ejecutar(requierePermiso('CONVOCATORIA_CREAR'), permisosTrabajadoraSocial), true);
});

test('trabajadora social con REQUISITO_BECA_GESTIONAR puede administrar requisitos de beca', () => {
  assert.equal(ejecutar(requierePermiso('REQUISITO_BECA_GESTIONAR'), ['REQUISITO_BECA_GESTIONAR']), true);
  assert.throws(() => ejecutar(requierePermiso('REQUISITO_BECA_GESTIONAR'), ['TIPO_BECA_VER']), /permiso/);
});

test('un rol sin CRITERIO_BECA_GESTIONAR queda bloqueado al intentar administrar criterios', () => {
  assert.throws(() => ejecutar(requierePermiso('CRITERIO_BECA_GESTIONAR'), ['CONVOCATORIA_VER']), /permiso/);
});
