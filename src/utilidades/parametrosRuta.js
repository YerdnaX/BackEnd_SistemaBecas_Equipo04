import { errorValidacion } from './errorAplicacion.js';

export function parametroIdPositivo(req, res, next, valor, nombre) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    return next(errorValidacion(`El parametro ${nombre} debe ser un identificador entero positivo.`));
  }
  return next();
}
