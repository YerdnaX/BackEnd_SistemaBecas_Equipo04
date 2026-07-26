import { errorValidacion, errorNoEncontrado, errorConflicto } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosCierre.js';
import { crearNotificacion } from '../../servicios-compartidos/servicioNotificaciones.js';
import { registrarAuditoria } from '../../servicios-compartidos/servicioAuditoria.js';

function listaBloqueadores(conteos) {
  const bloqueadores = [];
  if (conteos.ApelacionesPendientes > 0) bloqueadores.push(`${conteos.ApelacionesPendientes} apelación(es) sin resolver`);
  if (conteos.InvestigacionesPendientes > 0) bloqueadores.push(`${conteos.InvestigacionesPendientes} proceso(s) disciplinario(s) sin resolver`);
  if (conteos.JustificacionesPendientes > 0) bloqueadores.push(`${conteos.JustificacionesPendientes} justificación(es) de curso pendiente(s)`);
  if (conteos.RenovacionesPendientes > 0) bloqueadores.push(`${conteos.RenovacionesPendientes} renovación(es) pendiente(s)`);
  return bloqueadores;
}

export async function verificarBloqueadores(idExpediente) {
  const expediente = await datos.obtenerExpedienteBase(idExpediente);
  if (!expediente) throw errorNoEncontrado('El expediente no existe.');
  const conteos = await datos.obtenerBloqueadoresCierre(idExpediente, expediente.IdBecaActiva);
  return { expediente, bloqueadores: listaBloqueadores(conteos) };
}

export async function cerrarExpediente(idExpediente, { motivo, resumen }, idCerradoPor) {
  if (!motivo?.trim()) throw errorValidacion('Debe indicar el motivo del cierre.');

  const { expediente, bloqueadores } = await verificarBloqueadores(idExpediente);
  if (expediente.SoloLectura) throw errorConflicto('El expediente ya se encuentra cerrado.');
  if (bloqueadores.length > 0) {
    throw errorConflicto(`No se puede cerrar el expediente. Pendientes: ${bloqueadores.join('; ')}.`);
  }

  await datos.cerrarExpediente({ idExpediente, motivo, resumen, idCerradoPor });

  await registrarAuditoria({
    idUsuario: idCerradoPor,
    modulo: 'CIERRE_EXPEDIENTE',
    accion: 'EXPEDIENTE_CERRADO',
    entidad: 'Expediente',
    idEntidad: idExpediente,
    detalle: motivo
  });

  await crearNotificacion(null, {
    idUsuario: expediente.IdUsuario,
    tipo: 'EXPEDIENTE_CERRADO',
    titulo: 'Su expediente fue cerrado',
    mensaje: `Su expediente ${expediente.CodigoExpediente} fue cerrado. Motivo: ${motivo}`,
    enlace: `/trabajo-social/expedientes/${idExpediente}/cierre`
  });

  return datos.obtenerCierre(idExpediente);
}
