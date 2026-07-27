import { crearNotificacion } from './servicioNotificaciones.js';
import { enviarNotificacionPlantilla } from './servicioNotificacionesTransaccionales.js';

function informarFallo(canal, tipo, error) {
  console.error(`[notificaciones:${canal}] ${tipo}:`, error?.message || error);
}

/**
 * Registra primero la notificacion interna y luego intenta enviar el correo.
 * Los canales son independientes: un fallo de correo nunca revierte ni hace
 * fallar la operacion de negocio que ya fue confirmada.
 */
export async function crearNotificacionCompleta(transaccionOrPool, evento) {
  let internaRegistrada = false;
  let correo = { enviado: false, motivo: 'NO_INTENTADO' };

  try {
    await crearNotificacion(transaccionOrPool, evento);
    internaRegistrada = true;
  } catch (error) {
    informarFallo('interna', evento.tipo, error);
  }

  // Un correo no debe salir antes de confirmar una transaccion externa.
  if (!transaccionOrPool) {
    try {
      correo = await enviarNotificacionPlantilla(evento.tipo, evento.idUsuario, {
        titulo: evento.titulo,
        mensaje: evento.mensaje,
        enlace: evento.enlace || ''
      });
    } catch (error) {
      correo = { enviado: false, motivo: 'ERROR_ENVIO' };
      informarFallo('correo', evento.tipo, error);
    }
  }

  return { internaRegistrada, correo };
}
