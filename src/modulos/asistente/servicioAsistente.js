import { randomUUID } from 'node:crypto';
import { configuracion } from '../../configuracion/variablesEntorno.js';
import { ErrorAplicacion, errorNoEncontrado, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { TEXTO_REGLAMENTO_BECAS } from './conocimiento/reglamentoBecas.js';
import { TEXTO_DOCUMENTOS_REQUERIDOS } from './conocimiento/documentosRequeridos.js';

// Conversaciones en memoria (no persistentes): idConversacion -> { mensajes, ultimaActividad }.
// Alcanza para un chatbot de soporte sin historial entre reinicios del
// servidor; ver documentacion/GUIA_ASISTENTE_IA.md si se necesita persistirlas.
const conversaciones = new Map();

const MENSAJE_MAXIMO = 1000;
const MAXIMO_TURNOS_HISTORIAL = 12; // pares usuario/asistente reenviados como contexto
const MINUTOS_INACTIVIDAD_EXPIRA = 60;

const CONOCIMIENTO_REFERENCIA = [
  '=== REGLAMENTO DEL SISTEMA DE BECAS DEL CUC (La Gaceta N.º 189, 05/10/2022) ===',
  TEXTO_REGLAMENTO_BECAS,
  '',
  '=== DOCUMENTOS REQUERIDOS PARA SOLICITAR LA BECA SOCIOECONÓMICA ===',
  TEXTO_DOCUMENTOS_REQUERIDOS
].join('\n');

const INSTRUCCION_SISTEMA = [
  'Eres el asistente virtual del Sistema de Gestión de Becas Estudiantiles (SGBE) del Colegio Universitario de Cartago (CUC).',
  'Respondes en español, de forma breve, clara y cordial.',
  'Usa ÚNICAMENTE la información del reglamento y la lista de documentos incluida más abajo (delimitada con "===")',
  'para responder sobre becas: tipos de beca, montos o porcentajes de exoneración, requisitos, documentos,',
  'plazos, deberes de la persona becada, causales de suspensión o pérdida de la beca, apoyos económicos',
  'extraordinarios y el proceso de solicitud. Cuando corresponda, cita el número de artículo (por ejemplo',
  '"según el Artículo 6").',
  'Si la pregunta no se puede responder con ese contenido, dilo con honestidad y sugiere contactar a la Unidad',
  'de Trabajo Social (Jennifer Araya Pérez, jarayap@cuc.ac.cr, tel. 2550-6282 / 2552-6231, WhatsApp 8359-4035);',
  'nunca inventes artículos, montos, plazos ni políticas que no estén en el texto de referencia.',
  '',
  CONOCIMIENTO_REFERENCIA
].join('\n');

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
