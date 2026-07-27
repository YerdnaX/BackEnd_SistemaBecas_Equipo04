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
