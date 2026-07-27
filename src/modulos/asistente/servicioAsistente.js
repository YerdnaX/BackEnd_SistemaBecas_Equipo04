import { randomUUID } from 'node:crypto';
import { configuracion } from '../../configuracion/variablesEntorno.js';
import { ErrorAplicacion, errorNoEncontrado, errorValidacion } from '../../utilidades/errorAplicacion.js';

// Conversaciones en memoria (no persistentes): idConversacion -> { mensajes, ultimaActividad }.
// Alcanza para un chatbot de soporte sin historial entre reinicios del
// servidor; ver documentacion/GUIA_ASISTENTE_IA.md si se necesita persistirlas.
const conversaciones = new Map();

const MENSAJE_MAXIMO = 1000;
const MAXIMO_TURNOS_HISTORIAL = 12; // pares usuario/asistente reenviados como contexto
const MINUTOS_INACTIVIDAD_EXPIRA = 60;

const INSTRUCCION_SISTEMA = [
  'Eres el asistente virtual del Sistema de Gestión de Becas Estudiantiles (SGBE) de la Universidad CUC.',
  'Respondes en español, de forma breve, clara y cordial, sobre el proceso de becas: convocatorias, requisitos,',
  'solicitudes, documentos, subsanaciones, evaluación, comité, resolución, formalización, seguimiento, renovación,',
  'justificaciones, apelaciones y suspensión o cancelación.',
  'Si no tienes información suficiente o la pregunta no tiene relación con el sistema de becas, dilo con honestidad',
  'y sugiere contactar a la Oficina de Becas; nunca inventes plazos, montos ni políticas.'
].join(' ');

function proveedorConfigurado() {
  return Boolean(configuracion.asistenteIA.apiKey);
}

function exigirConfiguracion() {
  if (!proveedorConfigurado()) {
    throw new ErrorAplicacion(
      'El asistente virtual no está configurado en el servidor (falta ASISTENTE_IA_API_KEY).',
      { codigo: 'ASISTENTE_NO_CONFIGURADO', estadoHttp: 503 }
    );
  }
}

function sesionExpirada(sesion) {
  return Date.now() - sesion.ultimaActividad > MINUTOS_INACTIVIDAD_EXPIRA * 60 * 1000;
}

function obtenerSesion(idConversacion) {
  const sesion = conversaciones.get(idConversacion);
  if (!sesion || sesionExpirada(sesion)) {
    conversaciones.delete(idConversacion);
    throw errorNoEncontrado('La conversación expiró o no existe. Inicie una nueva.');
  }
  return sesion;
}

export function iniciarConversacion() {
  exigirConfiguracion();
  const idConversacion = randomUUID();
  conversaciones.set(idConversacion, {
    mensajes: [{ role: 'system', content: INSTRUCCION_SISTEMA }],
    ultimaActividad: Date.now()
  });
  return { idConversacion };
}

export async function enviarMensaje(idConversacion, mensaje) {
  exigirConfiguracion();
  if (!mensaje?.trim()) throw errorValidacion('Debe escribir un mensaje.');
  if (mensaje.length > MENSAJE_MAXIMO) {
    throw errorValidacion(`El mensaje es demasiado largo (máximo ${MENSAJE_MAXIMO} caracteres).`);
  }

  const sesion = obtenerSesion(idConversacion);
  sesion.mensajes.push({ role: 'user', content: mensaje.trim() });

  // Conserva la instrucción de sistema + los últimos turnos, para no reenviar
  // un historial ilimitado (costo, latencia y ventana de contexto) en cada llamada.
  const limite = 1 + MAXIMO_TURNOS_HISTORIAL * 2;
  if (sesion.mensajes.length > limite) {
    sesion.mensajes = [sesion.mensajes[0], ...sesion.mensajes.slice(-(limite - 1))];
  }

  const controladorTiempo = new AbortController();
  const temporizador = setTimeout(() => controladorTiempo.abort(), configuracion.asistenteIA.timeoutMs);

  let respuesta;
  try {
    respuesta = await fetch(configuracion.asistenteIA.urlBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuracion.asistenteIA.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: configuracion.asistenteIA.modelo,
        messages: sesion.mensajes,
        temperature: 0.3
      }),
      signal: controladorTiempo.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ErrorAplicacion('El asistente tardó demasiado en responder. Intente de nuevo.', {
        codigo: 'ASISTENTE_TIEMPO_AGOTADO',
        estadoHttp: 504
      });
    }
    throw new ErrorAplicacion('No fue posible comunicarse con el asistente. Intente más tarde.', {
      codigo: 'ASISTENTE_SIN_CONEXION',
      estadoHttp: 502
    });
  } finally {
    clearTimeout(temporizador);
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 429) {
      throw new ErrorAplicacion('El asistente alcanzó su límite de uso gratuito. Intente de nuevo en unos minutos.', {
        codigo: 'ASISTENTE_LIMITE_PROVEEDOR',
        estadoHttp: 429
      });
    }
    throw new ErrorAplicacion(`El proveedor del asistente respondió con un error (${respuesta.status}).`, {
      codigo: 'ASISTENTE_ERROR_PROVEEDOR',
      estadoHttp: 502
    });
  }

  const texto = datos?.choices?.[0]?.message?.content?.trim();
  if (!texto) {
    throw new ErrorAplicacion('El asistente no devolvió una respuesta válida.', {
      codigo: 'ASISTENTE_ERROR_PROVEEDOR',
      estadoHttp: 502
    });
  }

  sesion.mensajes.push({ role: 'assistant', content: texto });
  sesion.ultimaActividad = Date.now();

  return { respuestas: [texto] };
}
