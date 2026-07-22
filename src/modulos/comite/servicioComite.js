import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosComite.js';
import { obtenerUsuarioPorId } from '../autenticacion/accesoDatosAutenticacion.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';

const TIPOS_DECISION = ['APROBADA', 'CONDICIONADA', 'LISTA_ESPERA', 'RECHAZADA'];

export async function listarExpedientesDisponibles(idConvocatoria) {
  return datos.obtenerExpedientesDisponibles(idConvocatoria);
}

export async function crearSesion({ idConvocatoria, nombre, idsExpedientes }, idUsuario) {
  if (!idConvocatoria) throw errorValidacion('Debe indicar la convocatoria.');
  if (!nombre?.trim()) throw errorValidacion('Debe indicar un nombre para la sesión.');
  if (!Array.isArray(idsExpedientes) || idsExpedientes.length === 0) {
    throw errorValidacion('Debe incluir al menos un expediente en la sesión.');
  }

  const idComite = await datos.obtenerOCrearComitePorDefecto();
  const idSesionComite = await datos.crearSesion({ idComite, idConvocatoria, nombre, idCreadoPor: idUsuario, idsExpedientes });
  return obtenerSesion(idSesionComite);
}

export async function obtenerSesion(idSesionComite) {
  const sesion = await datos.obtenerSesionPorId(idSesionComite);
  if (!sesion) throw errorNoEncontrado('La sesión no existe.');
  return sesion;
}

export async function registrarDecision(idSesionComite, idExpediente, { tipoDecision, porcentajeBeca, motivo }, idUsuario) {
  const sesion = await obtenerSesion(idSesionComite);
  if (sesion.Estado !== 'ABIERTA') throw errorConflicto('Solo se pueden registrar decisiones en una sesión abierta.');

  if (!TIPOS_DECISION.includes(tipoDecision)) throw errorValidacion('El tipo de decisión no es válido.');

  if (['APROBADA', 'CONDICIONADA'].includes(tipoDecision)) {
    const porcentaje = Number(porcentajeBeca);
    if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      throw errorValidacion('El porcentaje de beca debe estar entre 0 y 100.');
    }
  }
  if (['RECHAZADA', 'CONDICIONADA'].includes(tipoDecision) && !motivo?.trim()) {
    throw errorValidacion('Debe indicar el motivo de la decisión.');
  }

  const caso = await datos.obtenerCasoDeSesion(idSesionComite, idExpediente);
  if (!caso) throw errorNoEncontrado('El expediente no forma parte de esta sesión.');

  await datos.registrarDecision({
    idCasoSesion: caso.IdCasoSesion,
    tipoDecision,
    porcentajeBeca: ['APROBADA', 'CONDICIONADA'].includes(tipoDecision) ? porcentajeBeca : null,
    motivo,
    idRegistradoPor: idUsuario
  });

  return obtenerSesion(idSesionComite);
}

export async function cerrarSesion(idSesionComite, idUsuario) {
  const sesion = await obtenerSesion(idSesionComite);
  if (sesion.Estado !== 'ABIERTA') throw errorConflicto('La sesión ya fue cerrada.');
  if (sesion.casos.some((caso) => !caso.IdDecision)) {
    throw errorConflicto('Todos los casos deben tener una decisión registrada antes de cerrar la sesión.');
  }

  let resoluciones;
  try {
    resoluciones = await datos.cerrarSesionTransaccion(idSesionComite);
  } catch (error) {
    if (error.codigo === 'SESION_INCOMPLETA') {
      throw errorConflicto('Todos los casos deben tener una decisión registrada antes de cerrar la sesión.');
    }
    throw error;
  }

  const mensajesPorTipo = {
    APROBADA: 'Su solicitud de beca fue aprobada.',
    CONDICIONADA: 'Su solicitud de beca fue aprobada de forma condicionada.',
    LISTA_ESPERA: 'Su solicitud quedó en lista de espera.',
    RECHAZADA: 'Su solicitud de beca fue rechazada.'
  };

  for (const resolucion of resoluciones) {
    const usuario = await obtenerUsuarioPorId(resolucion.idUsuario);
    await crearNotificacion(null, {
      idUsuario: resolucion.idUsuario,
      tipo: 'RESOLUCION_PUBLICADA',
      titulo: 'Resultado de su solicitud disponible',
      mensaje: mensajesPorTipo[resolucion.tipoResultado] || 'Se publicó el resultado de su solicitud.',
      enlace: `/aspirante/solicitudes/${resolucion.idSolicitud}/resultado`
    });
    if (usuario) {
      await enviarCorreo({
        idUsuario: resolucion.idUsuario,
        correoDestino: usuario.Correo,
        asunto: 'Resultado de su solicitud - SGBE CUC',
        tipoMensaje: 'RESOLUCION_PUBLICADA',
        contenidoHtml: `<p>${mensajesPorTipo[resolucion.tipoResultado] || 'Se publicó el resultado de su solicitud.'} Número de resolución: ${resolucion.numeroResolucion}.</p>`
      });
    }
  }

  return obtenerSesion(idSesionComite);
}
