import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combinarRequisitosConvocatoria } from '../src/utilidades/requisitosConvocatoria.js';

const REQUISITOS_BECA_SOCIOECONOMICA = [
  { IdRequisitoBeca: 1, IdTipoBeca: 1, Nombre: 'Constancia de ingresos', Descripcion: null, IdTipoDocumento: 3, Obligatorio: true, Activo: true },
  { IdRequisitoBeca: 2, IdTipoBeca: 1, Nombre: 'Recibo de servicios', Descripcion: null, IdTipoDocumento: 4, Obligatorio: false, Activo: true }
];

const REQUISITOS_BECA_DEPORTIVA = [
  { IdRequisitoBeca: 3, IdTipoBeca: 2, Nombre: 'Carta del entrenador', Descripcion: null, IdTipoDocumento: 5, Obligatorio: true, Activo: true }
];

test('combinarRequisitosConvocatoria copia los requisitos de la plantilla de la beca', () => {
  const resultado = combinarRequisitosConvocatoria(REQUISITOS_BECA_SOCIOECONOMICA, []);
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado[0], {
    nombre: 'Constancia de ingresos', descripcion: null, idTipoDocumento: 3, obligatorio: true
  });
  assert.equal(resultado[1].obligatorio, false);
});

test('combinarRequisitosConvocatoria no mezcla requisitos de becas distintas', () => {
  const socioeconomica = combinarRequisitosConvocatoria(REQUISITOS_BECA_SOCIOECONOMICA, []);
  const deportiva = combinarRequisitosConvocatoria(REQUISITOS_BECA_DEPORTIVA, []);

  const nombresSocioeconomica = socioeconomica.map((r) => r.nombre);
  const nombresDeportiva = deportiva.map((r) => r.nombre);

  assert.deepEqual(nombresSocioeconomica, ['Constancia de ingresos', 'Recibo de servicios']);
  assert.deepEqual(nombresDeportiva, ['Carta del entrenador']);
  nombresDeportiva.forEach((nombre) => assert.ok(!nombresSocioeconomica.includes(nombre)));
});

test('combinarRequisitosConvocatoria agrega los requisitos adicionales de la convocatoria sin descartar los de la beca', () => {
  const adicionales = [{ nombre: 'Carta de recomendación', descripcion: 'Firmada', idTipoDocumento: null, obligatorio: false }];
  const resultado = combinarRequisitosConvocatoria(REQUISITOS_BECA_SOCIOECONOMICA, adicionales);
  assert.equal(resultado.length, 3);
  assert.equal(resultado[2].nombre, 'Carta de recomendación');
});
