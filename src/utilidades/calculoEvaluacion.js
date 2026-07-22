export function calcularPuntajePonderado(puntaje, porcentaje) {
  return Number(((Number(puntaje) * Number(porcentaje)) / 100).toFixed(2));
}

export function calcularPuntajeTotal(puntajesPonderados) {
  return Number(puntajesPonderados.reduce((total, valor) => total + Number(valor), 0).toFixed(2));
}
