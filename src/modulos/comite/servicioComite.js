import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import { resolverDecisionMayoritaria, validarCantidadMiembrosComite } from '../../utilidades/evaluacionQuintilesComite.js';
import * as datos from './accesoDatosComite.js';
import { obtenerUsuarioPorId } from '../autenticacion/accesoDatosAutenticacion.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { enviarCorreo } from '../../servicios-compartidos/servicioCorreo.js';

const TIPOS_DECISION = ['APROBADA', 'CONDICIONADA', 'LISTA_ESPERA', 'RECHAZADA'];

export async function listarExpedientesDisponibles(idConvocatoria) {
  return datos.obtenerExpedientesDisponibles(idConvocatoria);
}

export async function listarSesiones(idUsuario) {
  return datos.listarSesionesParaUsuario(idUsuario);
}

export async function crearSesion({ idConvocatoria, nombre, idsExpedientes }, idUsuario) {
  if (!idConvocatoria) throw errorValidacion('Debe indicar la convocatoria.');
  if (!nombre?.trim()) throw errorValidacion('Debe indicar un nombre para la sesion.');
  if (!Array.isArray(idsExpedientes) || idsExpedientes.length === 0) {
    throw errorValidacion('Debe incluir al menos un expediente en la sesion.');
  }
  const disponibles = await datos.obtenerExpedientesDisponibles(idConvocatoria);
  const idsDisponibles = new Set(disponibles.map((item) => item.IdExpediente));
  if (idsExpedientes.some((id) => !idsDisponibles.has(Number(id)))) {
    throw errorValidacion('Todos los expedientes deben pertenecer al periodo, estar en comite, en quintil 1 o 2 y contar con informe social.');
  }
  const idComite = await datos.obtenerOCrearComitePorDefecto();
  const miembros = await datos.listarMiembrosVigentes(idComite);
  validarCantidadMiembrosComite(miembros.length);
  const idSesionComite = await datos.crearSesion({
    idComite,
    idConvocatoria,
    nombre: nombre.trim(),
    idCreadoPor: idUsuario,
    idsExpedientes: idsExpedientes.map(Number),
    miembros
  });
  return obtenerSesion(idSesionComite, idUsuario);
}

export async function obtenerSesion(idSesionComite, idUsuario) {
  const sesion = await datos.obtenerSesionPorId(idSesionComite, idUsuario);
  if (!sesion) throw errorNoEncontrado('La sesion no existe.');
  return sesion;
}

export async function registrarVoto(idSesionComite, idExpediente, { tipoDecision, motivo }, idUsuario) {
  const sesion = await obtenerSesion(idSesionComite, idUsuario);
  if (sesion.Estado !== 'ABIERTA') throw errorConflicto('Solo se puede votar en una sesion abierta.');
  if (!TIPOS_DECISION.includes(tipoDecision)) throw errorValidacion('El tipo de decision no es valido.');
  if (['RECHAZADA', 'CONDICIONADA'].includes(tipoDecision) && !motivo?.trim()) {
    throw errorValidacion('Debe indicar el motivo de este voto.');
  }
  const miembro = await datos.obtenerMiembroSesionPorUsuario(idSesionComite, idUsuario);
  if (!miembro) throw errorConflicto('Solo los integrantes registrados en esta sesion pueden votar.');
  const caso = await datos.obtenerCasoDeSesion(idSesionComite, idExpediente);
  if (!caso) throw errorNoEncontrado('El expediente no forma parte de esta sesion.');
  await datos.registrarVoto({
    idCasoSesion: caso.IdCasoSesion,
    idMiembroComite: miembro.IdMiembroComite,
    tipoDecision,
    motivo: motivo?.trim()
  });
  return obtenerSesion(idSesionComite, idUsuario);
}

function construirAcuerdos(sesion) {
  validarCantidadMiembrosComite(sesion.miembros.length);
  return sesion.casos.map((caso) => {
    const resultado = resolverDecisionMayoritaria(
      caso.votos.map((voto) => voto.TipoDecision),
      sesion.miembros.length
    );
    const motivos = caso.votos
      .filter((voto) => voto.TipoDecision === resultado.decision && voto.Motivo)
      .map((voto) => voto.Motivo.trim());
    return {
      idCasoSesion: caso.IdCasoSesion,
      tipoDecision: resultado.decision,
      motivo: motivos.join(' | ') || `Acuerdo por mayoria absoluta: ${resultado.cantidad} de ${resultado.total} votos.`
    };
  });
}

export async function cerrarSesion(idSesionComite, idUsuario) {
  const sesion = await obtenerSesion(idSesionComite, idUsuario);
  if (sesion.Estado !== 'ABIERTA') throw errorConflicto('La sesion ya fue cerrada.');
  if (!sesion.miembroActual) throw errorConflicto('Solo un integrante de esta sesion puede cerrarla.');
  const acuerdos = construirAcuerdos(sesion);
  const resoluciones = await datos.cerrarSesionTransaccion(idSesionComite, acuerdos, idUsuario);

  const mensajesPorTipo = {
    APROBADA: 'Su solicitud de beca fue aprobada.',
    CONDICIONADA: 'Su solicitud de beca fue aprobada de forma condicionada.',
    LISTA_ESPERA: 'Su solicitud quedo en lista de espera.',
    RECHAZADA: 'Su solicitud de beca fue rechazada.'
  };
  for (const resolucion of resoluciones) {
    const usuario = await obtenerUsuarioPorId(resolucion.idUsuario);
    const mensaje = mensajesPorTipo[resolucion.tipoResultado] || 'Se publico el resultado de su solicitud.';
    await crearNotificacion(null, {
      idUsuario: resolucion.idUsuario,
      tipo: 'RESOLUCION_PUBLICADA',
      titulo: 'Resultado de su solicitud disponible',
      mensaje,
      enlace: `/aspirante/solicitudes/${resolucion.idSolicitud}/resultado`
    });
    if (usuario) {
      await enviarCorreo({
        idUsuario: resolucion.idUsuario,
        correoDestino: usuario.Correo,
        asunto: 'Resultado de su solicitud - SGBE CUC',
        tipoMensaje: 'RESOLUCION_PUBLICADA',
        contenidoHtml: `<p>${mensaje} Numero de resolucion: ${resolucion.numeroResolucion}.</p>`
      });
    }
  }
  return obtenerSesion(idSesionComite, idUsuario);
}
