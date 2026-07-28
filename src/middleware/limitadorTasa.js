import rateLimit from 'express-rate-limit';
import { configuracion } from '../configuracion/variablesEntorno.js';
import { enviarError } from '../utilidades/respuestas.js';

function manejadorLimite(req, res) {
  enviarError(res, {
    codigo: 'DEMASIADOS_INTENTOS',
    mensaje: 'Demasiados intentos. Intente de nuevo en unos minutos.',
    estadoHttp: 429
  });
}

export const limitadorAutenticacion = configuracion.autenticacion.limiteTasaHabilitado
  ? rateLimit({
    windowMs: configuracion.autenticacion.limiteTasaVentanaMs,
    limit: configuracion.autenticacion.limiteTasaMaximo,
    standardHeaders: true,
    legacyHeaders: false,
    handler: manejadorLimite
  })
  : (req, res, next) => next();

// Endpoint público (sin sesión) más expuesto del sistema: el botón de chat
// del asistente. Sin este límite, cualquiera puede agotar la cuota de
// Copilot Studio o abusar del proxy sin restricción.
export const limitadorAsistente = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: manejadorLimite
});
