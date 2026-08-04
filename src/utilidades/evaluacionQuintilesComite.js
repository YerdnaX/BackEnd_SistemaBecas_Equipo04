import { errorConflicto, errorValidacion } from './errorAplicacion.js';

const PUNTAJE_POR_QUINTIL = Object.freeze({
  1: 100,
  2: 80,
  3: 60,
  4: 40,
  5: 20
});

export const UMBRALES_QUINTIL_CR_2025 = Object.freeze({
  maximoQ1: 96749,
  maximoQ2: 165513,
  maximoQ3: 274326,
  maximoQ4: 506559
});

export function calcularQuintilCostaRica(ingresoPerCapita, umbrales = UMBRALES_QUINTIL_CR_2025) {
  const ingreso = Number(ingresoPerCapita);
  if (!Number.isFinite(ingreso) || ingreso < 0) {
    throw errorValidacion('El ingreso per capita debe ser un numero mayor o igual a cero.');
  }
  if (ingreso <= Number(umbrales.maximoQ1)) return 1;
  if (ingreso <= Number(umbrales.maximoQ2)) return 2;
  if (ingreso <= Number(umbrales.maximoQ3)) return 3;
  if (ingreso <= Number(umbrales.maximoQ4)) return 4;
  return 5;
}

export function quintilEsElegible(quintil) {
  return Number.isInteger(Number(quintil)) && Number(quintil) >= 1 && Number(quintil) <= 2;
}

export function puntajeSocioeconomicoPorQuintil(quintil) {
  const puntaje = PUNTAJE_POR_QUINTIL[Number(quintil)];
  if (puntaje === undefined) throw errorValidacion('El quintil calculado debe estar entre 1 y 5.');
  return puntaje;
}

export function validarCantidadMiembrosComite(cantidad) {
  const total = Number(cantidad);
  if (!Number.isInteger(total) || total < 3 || total % 2 === 0) {
    throw errorConflicto('El comite debe tener una cantidad impar de al menos tres integrantes vigentes.');
  }
  return total;
}

export function resolverDecisionMayoritaria(votos, cantidadMiembros) {
  const total = validarCantidadMiembrosComite(cantidadMiembros);
  if (!Array.isArray(votos) || votos.length !== total) {
    throw errorConflicto('Todos los integrantes del comite deben votar antes de cerrar la sesion.');
  }

  const conteo = votos.reduce((acumulado, voto) => {
    acumulado[voto] = (acumulado[voto] || 0) + 1;
    return acumulado;
  }, {});
  const [decision, cantidad] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0] || [];
  if (!decision || cantidad <= total / 2) {
    throw errorConflicto('La decision del caso no alcanza mayoria absoluta. Los integrantes deben revisar sus votos.');
  }
  return { decision, cantidad, total };
}
