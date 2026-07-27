import { errorConflicto, errorNoEncontrado, errorProhibido, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { obtenerPaginacion, validarProgramacionVisita } from '../../utilidades/reglasSegmentoDos.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import * as datos from './accesoDatosComunicaciones.js';

export const listarVisitas = (idExpediente) => datos.listarVisitas(idExpediente);

export async function programarVisita(idExpediente, usuario, entrada) {
  const fecha = validarProgramacionVisita(entrada.fechaProgramada);
  const propietario = await datos.obtenerPropietarioExpediente(idExpediente);
  if (!propietario) throw errorNoEncontrado('El expediente no existe.');
  if (!entrada.direccion?.trim()) throw errorValidacion('La direccion es obligatoria.');
  if (await datos.existeTraslapeVisita(usuario.idUsuario, fecha)) {
    throw errorConflicto('El responsable ya tiene una visita cercana a esa hora.');
  }
  const idVisita = await datos.crearVisita(idExpediente, usuario.idUsuario, { ...entrada, fechaProgramada: fecha });
  await crearNotificacion(null, {
    idUsuario: propietario.IdUsuario,
    tipo: 'VISITA_PROGRAMADA',
    titulo: 'Visita domiciliaria programada',
    mensaje: `La visita fue programada para ${fecha.toLocaleString('es-CR')}.`,
    enlace: '/consultas'
  });
  return { idVisita };
}

export async function reprogramarVisita(idVisita, usuario, entrada) {
  const visita = await datos.obtenerVisita(idVisita);
  if (!visita) throw errorNoEncontrado('La visita no existe.');
  const fecha = validarProgramacionVisita(entrada.fechaProgramada);
  if (await datos.existeTraslapeVisita(usuario.idUsuario, fecha, idVisita)) {
    throw errorConflicto('El responsable ya tiene una visita cercana a esa hora.');
  }
  await datos.actualizarVisita(idVisita, usuario.idUsuario, { ...entrada, fechaProgramada: fecha });
  const propietario = await datos.obtenerPropietarioExpediente(visita.IdExpediente);
  await crearNotificacion(null, {
    idUsuario: propietario.IdUsuario,
    tipo: 'VISITA_MODIFICADA',
    titulo: 'Visita domiciliaria reprogramada',
    mensaje: `La nueva fecha es ${fecha.toLocaleString('es-CR')}.`,
    enlace: '/consultas'
  });
  return datos.obtenerVisita(idVisita);
}

export async function cancelarVisita(idVisita, entrada) {
  const visita = await datos.obtenerVisita(idVisita);
  if (!visita) throw errorNoEncontrado('La visita no existe.');
  await datos.cancelarVisita(idVisita, entrada.observacion);
  const propietario = await datos.obtenerPropietarioExpediente(visita.IdExpediente);
  await crearNotificacion(null, {
    idUsuario: propietario.IdUsuario,
    tipo: 'VISITA_CANCELADA',
    titulo: 'Visita domiciliaria cancelada',
    mensaje: entrada.observacion || 'La visita fue cancelada.',
    enlace: '/consultas'
  });
}

export async function registrarInforme(idVisita, entrada) {
  if (!entrada.resultado?.trim()) throw errorValidacion('El resultado es obligatorio.');
  const resultado = await datos.registrarInformeVisita(idVisita, entrada);
  if (!resultado) throw errorNoEncontrado('La visita no existe.');
  return resultado;
}

export const listarConsultasPropias = (usuario) => datos.listarConsultasPropias(usuario.idUsuario);

export async function crearConsulta(usuario, entrada) {
  if (!entrada.asunto?.trim() || !entrada.mensaje?.trim()) {
    throw errorValidacion('El asunto y el mensaje son obligatorios.');
  }
  return { idConsulta: await datos.crearConsulta(usuario.idUsuario, entrada) };
}

function puedeGestionarConsultas(usuario) {
  return usuario.permisos.includes('CONSULTA_GESTIONAR');
}

export async function obtenerConsulta(idConsulta, usuario) {
  const consulta = await datos.obtenerConsulta(idConsulta);
  if (!consulta) throw errorNoEncontrado('La consulta no existe.');
  if (consulta.IdUsuario !== usuario.idUsuario && !puedeGestionarConsultas(usuario)) throw errorProhibido();
  return consulta;
}

export async function responderConsulta(idConsulta, usuario, entrada) {
  const consulta = await obtenerConsulta(idConsulta, usuario);
  if (consulta.Estado === 'CERRADA') throw errorConflicto('La consulta se encuentra cerrada.');
  if (!entrada.mensaje?.trim()) throw errorValidacion('El mensaje es obligatorio.');
  await datos.agregarMensajeConsulta(idConsulta, usuario.idUsuario, entrada.mensaje.trim());
  if (consulta.IdUsuario !== usuario.idUsuario) {
    await crearNotificacion(null, {
      idUsuario: consulta.IdUsuario,
      tipo: 'CONSULTA_RESPONDIDA',
      titulo: 'Nueva respuesta a su consulta',
      mensaje: entrada.mensaje.trim().slice(0, 180),
      enlace: `/consultas?id=${idConsulta}`
    });
  }
  return obtenerConsulta(idConsulta, usuario);
}

export function listarBandeja(consulta) {
  return datos.listarConsultasTrabajoSocial({ ...consulta, ...obtenerPaginacion(consulta) });
}

export async function asignarConsulta(idConsulta, usuario) {
  const asignada = await datos.asignarConsulta(idConsulta, usuario.idUsuario);
  if (!asignada) throw errorConflicto('La consulta no puede asignarse.');
}

export async function cambiarEstadoConsulta(idConsulta, estado) {
  if (!['ABIERTA', 'RESPONDIDA', 'CERRADA'].includes(estado)) {
    throw errorValidacion('El estado no es valido.');
  }
  await datos.cambiarEstadoConsulta(idConsulta, estado);
}

export const listarNoticias = (usuario) => datos.listarNoticias(usuario);

export async function obtenerNoticia(id, usuario) {
  const noticia = await datos.obtenerNoticia(id, usuario);
  if (!noticia) throw errorNoEncontrado('La noticia no existe o no esta publicada para este publico.');
  return noticia;
}

function validarNoticia(entrada) {
  if (!entrada.titulo?.trim() || !entrada.contenido?.trim()) {
    throw errorValidacion('El titulo y el contenido son obligatorios.');
  }
  if (!['GENERAL', 'ASPIRANTE', 'BECADO'].includes(entrada.publicoDestino)) {
    throw errorValidacion('El publico destino no es valido.');
  }
}

export async function crearNoticia(usuario, entrada) {
  validarNoticia(entrada);
  return { idNoticia: await datos.crearNoticia(usuario.idUsuario, entrada) };
}

export async function actualizarNoticia(id, entrada) {
  validarNoticia(entrada);
  await datos.actualizarNoticia(id, entrada);
}

export async function cambiarEstadoNoticia(id, estado) {
  if (!['BORRADOR', 'PUBLICADA', 'DESPUBLICADA', 'INACTIVA'].includes(estado)) {
    throw errorValidacion('El estado no es valido.');
  }
  const estadoPersistido = ['DESPUBLICADA', 'INACTIVA'].includes(estado) ? 'ARCHIVADA' : estado;
  await datos.cambiarEstadoNoticia(id, estadoPersistido);
}
