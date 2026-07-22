import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrasenaEsSegura, correoEsValido } from '../src/utilidades/validaciones.js';

test('contrasenaEsSegura rechaza contraseñas cortas o sin requisitos', () => {
  assert.equal(contrasenaEsSegura('corta1!'), false);
  assert.equal(contrasenaEsSegura('sinmayuscula1!'), false);
  assert.equal(contrasenaEsSegura('SinNumero!'), false);
  assert.equal(contrasenaEsSegura('SinEspecial1'), false);
});

test('contrasenaEsSegura acepta una contraseña que cumple todas las reglas', () => {
  assert.equal(contrasenaEsSegura('Avalon2020!!'), true);
});

test('correoEsValido valida el formato básico de correo', () => {
  assert.equal(correoEsValido('persona@cuc.ac.cr'), true);
  assert.equal(correoEsValido('correo-invalido'), false);
  assert.equal(correoEsValido(''), false);
});
