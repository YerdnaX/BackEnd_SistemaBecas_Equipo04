import { errorValidacion, errorNoEncontrado } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosChatbot.js';
import { obtenerParametro } from '../../servicios-compartidos/servicioParametros.js';
import { registrarAuditoria } from '../../servicios-compartidos/servicioAuditoria.js';

const RESPUESTA_SIN_COINCIDENCIA = 'No encontré una respuesta exacta para esa consulta. Puede escribir a la Oficina de Becas o consultar la sección de preguntas frecuentes.';

export async function consultarPublico(pregunta) {
  if (!pregunta?.trim() || pregunta.trim().length < 3) {
    throw errorValidacion('Escriba una pregunta de al menos 3 caracteres.');
  }
  const limite = await obtenerParametro('CHATBOT_MAXIMO_RESULTADOS', 3);
  const coincidencias = await datos.buscarPreguntas(pregunta.trim(), limite);

  if (coincidencias.length === 0) {
    return { encontrado: false, mensaje: RESPUESTA_SIN_COINCIDENCIA, sugerencias: [] };
  }
  return {
    encontrado: true,
    respuestaPrincipal: coincidencias[0],
    sugerencias: coincidencias.slice(1)
  };
}

export async function listarCategorias() {
  return datos.listarCategorias();
}

export async function listarEntradas(filtros, usuario) {
  const puedeGestionar = usuario.permisos.includes('CHATBOT_GESTIONAR');
  return datos.listarEntradas({ ...filtros, soloActivas: !puedeGestionar });
}

export async function crearEntrada({ pregunta, respuesta, categoria, palabrasClave }, usuario) {
  if (!pregunta?.trim() || !respuesta?.trim()) throw errorValidacion('Debe indicar pregunta y respuesta.');
  const id = await datos.crearEntrada({ pregunta, respuesta, categoria, palabrasClave, idAutor: usuario.idUsuario });
  await registrarAuditoria({ idUsuario: usuario.idUsuario, modulo: 'CHATBOT', accion: 'ENTRADA_CREADA', entidad: 'PreguntaRespuestaChatbot', idEntidad: id });
  return datos.obtenerEntradaPorId(id);
}

export async function actualizarEntrada(id, cuerpo, usuario) {
  const existente = await datos.obtenerEntradaPorId(id);
  if (!existente) throw errorNoEncontrado('La entrada no existe.');
  if (!cuerpo.pregunta?.trim() || !cuerpo.respuesta?.trim()) throw errorValidacion('Debe indicar pregunta y respuesta.');

  await datos.actualizarEntrada(id, {
    pregunta: cuerpo.pregunta,
    respuesta: cuerpo.respuesta,
    categoria: cuerpo.categoria,
    palabrasClave: cuerpo.palabrasClave,
    activo: cuerpo.activo ?? existente.Activo
  });
  await registrarAuditoria({ idUsuario: usuario.idUsuario, modulo: 'CHATBOT', accion: 'ENTRADA_ACTUALIZADA', entidad: 'PreguntaRespuestaChatbot', idEntidad: id });
  return datos.obtenerEntradaPorId(id);
}

export async function eliminarEntrada(id, usuario) {
  const existente = await datos.obtenerEntradaPorId(id);
  if (!existente) throw errorNoEncontrado('La entrada no existe.');
  await datos.eliminarEntrada(id);
  await registrarAuditoria({ idUsuario: usuario.idUsuario, modulo: 'CHATBOT', accion: 'ENTRADA_DESACTIVADA', entidad: 'PreguntaRespuestaChatbot', idEntidad: id });
  return { desactivada: true };
}
