import rateLimit from 'express-rate-limit';
import { enviarError } from '../utilidades/respuestas.js';

function manejadorLimite(req, res) {
  enviarError(res, {
    codigo: 'DEMASIADOS_INTENTOS',
    mensaje: 'Demasiados intentos. Intente de nuevo en unos minutos.',
    estadoHttp: 429
  });
}

export const limitadorAutenticacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: manejadorLimite
});
