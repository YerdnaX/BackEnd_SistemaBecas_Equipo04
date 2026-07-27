import { errorNoEncontrado } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosSeguridad.js';
import { registrarAuditoria, registrarEventoSeguridad } from '../../servicios-compartidos/servicioAuditoria.js';

export async function listarAuditoria(filtros) {
  return datos.listarAuditoria(filtros);
}

export async function listarEventosSeguridad(filtros) {
  return datos.listarEventosSeguridad(filtros);
}

export async function listarSesionesPropias(idUsuario) {
  return datos.listarSesionesPropias(idUsuario);
}

export async function listarSesionesActivas() {
  return datos.listarSesionesActivas();
}

export async function revocarSesionPropia(idSesion, usuario) {
  const sesion = await datos.obtenerSesionPorId(idSesion);
  if (!sesion || sesion.IdUsuario !== usuario.idUsuario) throw errorNoEncontrado('La sesión no existe.');
  if (!sesion.Activa) return { revocada: true };

  await datos.revocarSesionPorId(idSesion);
  await registrarEventoSeguridad({
    idUsuario: usuario.idUsuario,
    tipoEvento: 'SESION_REVOCADA_PROPIA',
    descripcion: `El usuario revocó su propia sesión #${idSesion}.`,
    nivel: 'INFO'
  });
  await registrarAuditoria({ idUsuario: usuario.idUsuario, modulo: 'SEGURIDAD', accion: 'SESION_REVOCADA', entidad: 'Sesion', idEntidad: idSesion });
  return { revocada: true };
}

export async function revocarSesionAdministrativa(idSesion, idAdministrador) {
  const sesion = await datos.obtenerSesionPorId(idSesion);
  if (!sesion) throw errorNoEncontrado('La sesión no existe.');
  if (!sesion.Activa) return { revocada: true };

  await datos.revocarSesionPorId(idSesion);
  await registrarEventoSeguridad({
    idUsuario: sesion.IdUsuario,
    tipoEvento: 'SESION_REVOCADA_ADMIN',
    descripcion: `Un administrador revocó la sesión #${idSesion}.`,
    nivel: 'ADVERTENCIA'
  });
  await registrarAuditoria({ idUsuario: idAdministrador, modulo: 'SEGURIDAD', accion: 'SESION_REVOCADA_ADMIN', entidad: 'Sesion', idEntidad: idSesion, detalle: `Usuario afectado: ${sesion.IdUsuario}` });
  return { revocada: true };
}
