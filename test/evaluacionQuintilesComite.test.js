import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQuintilCostaRica,
  puntajeSocioeconomicoPorQuintil,
  quintilEsElegible,
  resolverDecisionMayoritaria,
  validarCantidadMiembrosComite
} from '../src/utilidades/evaluacionQuintilesComite.js';

test('clasifica el ingreso per capita con los umbrales nacionales ENAHO 2025', () => {
  assert.equal(calcularQuintilCostaRica(95000), 1);
  assert.equal(calcularQuintilCostaRica(96749), 1);
  assert.equal(calcularQuintilCostaRica(96750), 2);
  assert.equal(calcularQuintilCostaRica(165513), 2);
  assert.equal(calcularQuintilCostaRica(165514), 3);
  assert.equal(calcularQuintilCostaRica(506560), 5);
});

test('solo los dos primeros quintiles cumplen el criterio socioeconomico', () => {
  assert.equal(quintilEsElegible(1), true);
  assert.equal(quintilEsElegible(2), true);
  assert.equal(quintilEsElegible(3), false);
  assert.equal(puntajeSocioeconomicoPorQuintil(1), 100);
  assert.equal(puntajeSocioeconomicoPorQuintil(2), 80);
});

test('el comite requiere una cantidad impar de al menos tres integrantes', () => {
  assert.equal(validarCantidadMiembrosComite(3), 3);
  assert.throws(() => validarCantidadMiembrosComite(2), /impar/);
  assert.throws(() => validarCantidadMiembrosComite(4), /impar/);
});

test('la decision grupal requiere todos los votos y mayoria absoluta', () => {
  assert.deepEqual(
    resolverDecisionMayoritaria(['APROBADA', 'APROBADA', 'RECHAZADA'], 3),
    { decision: 'APROBADA', cantidad: 2, total: 3 }
  );
  assert.throws(
    () => resolverDecisionMayoritaria(['APROBADA', 'RECHAZADA', 'LISTA_ESPERA'], 3),
    /mayoria absoluta/
  );
});
