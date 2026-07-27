import bcrypt from 'bcryptjs';
import { errorNoEncontrado, errorValidacion } from '../../utilidades/errorAplicacion.js';
import { contrasenaEsSegura, correoEsValido } from '../../utilidades/validaciones.js';
import { obtenerPaginacion } from '../../utilidades/reglasSegmentoDos.js';
import { guardarArchivo, obtenerArchivo } from '../../servicios-compartidos/servicioArchivos.js';
import { crearNotificacionCompleta as crearNotificacion } from '../../servicios-compartidos/servicioNotificacionesEventos.js';
import { crearPdfSimple } from '../../utilidades/crearPdfSimple.js';
import * as datos from './accesoDatosAdministracion.js';

function validarUsuario(entrada, requiereContrasena = false) {
  if (!entrada.nombre?.trim() || !entrada.primerApellido?.trim() || !correoEsValido(entrada.correo)) {
    throw errorValidacion('Nombre, primer apellido y correo valido son obligatorios.');
  }
  if (requiereContrasena && !contrasenaEsSegura(entrada.contrasena)) {
    throw errorValidacion('La contrasena temporal no cumple los requisitos de seguridad.');
  }
}

export const listarUsuarios = (consulta) => datos.listarUsuarios({ ...consulta, ...obtenerPaginacion(consulta) });

export async function obtenerUsuario(id) {
  const usuario = await datos.obtenerUsuario(id);
  if (!usuario) throw errorNoEncontrado('El usuario no existe.');
  return usuario;
}

export async function crearUsuario(actor, entrada) {
  validarUsuario(entrada, true);
  const hash = await bcrypt.hash(entrada.contrasena, 12);
  const idUsuario = await datos.crearUsuario(entrada, hash);
  if (entrada.idsRoles?.length) await datos.asignarRoles(idUsuario, entrada.idsRoles.map(Number));
  await datos.registrarAuditoria(actor.idUsuario, 'USUARIOS', 'CREAR', 'Usuarios', idUsuario, entrada.correo);
  return obtenerUsuario(idUsuario);
}

export async function actualizarUsuario(actor, id, entrada) {
  await obtenerUsuario(id);
  validarUsuario(entrada);
  await datos.actualizarUsuario(id, entrada);
  await datos.registrarAuditoria(actor.idUsuario, 'USUARIOS', 'ACTUALIZAR', 'Usuarios', id);
  return obtenerUsuario(id);
}

export async function cambiarEstadoUsuario(actor, id, estado) {
  if (!['ACTIVO', 'BLOQUEADO', 'INACTIVO'].includes(estado)) throw errorValidacion('El estado no es valido.');
  await obtenerUsuario(id);
  await datos.cambiarEstadoUsuario(id, estado);
  await datos.registrarAuditoria(actor.idUsuario, 'USUARIOS', 'CAMBIAR_ESTADO', 'Usuarios', id, estado);
  await crearNotificacion(null, {
    idUsuario: id,
    tipo: 'ESTADO_CUENTA',
    titulo: 'Estado de cuenta actualizado',
    mensaje: `Su cuenta cambio al estado ${estado}.`,
    enlace: '/login'
  });
}

export async function asignarRoles(actor, id, idsRoles) {
  await obtenerUsuario(id);
  if (!Array.isArray(idsRoles)) throw errorValidacion('Debe enviar una lista de roles.');
  await datos.asignarRoles(id, idsRoles.map(Number));
  await datos.registrarAuditoria(actor.idUsuario, 'USUARIOS', 'ASIGNAR_ROLES', 'Usuarios', id, idsRoles.join(','));
  await crearNotificacion(null, {
    idUsuario: id,
    tipo: 'ROLES_ACTUALIZADOS',
    titulo: 'Roles actualizados',
    mensaje: 'Sus roles y permisos de acceso fueron actualizados. Inicie sesion nuevamente.',
    enlace: '/login'
  });
  return obtenerUsuario(id);
}

export const listarRoles = () => datos.listarRoles();

export async function crearRol(actor, entrada) {
  if (!entrada.codigo?.trim() || !entrada.nombre?.trim()) throw errorValidacion('Codigo y nombre son obligatorios.');
  const idRol = await datos.crearRol({ ...entrada, codigo: entrada.codigo.trim().toUpperCase() });
  await datos.registrarAuditoria(actor.idUsuario, 'ROLES', 'CREAR', 'Roles', idRol);
  return { idRol };
}

export async function actualizarRol(actor, id, entrada) {
  if (!entrada.nombre?.trim()) throw errorValidacion('El nombre es obligatorio.');
  if (!(await datos.listarRoles()).some((rol) => rol.IdRol === id)) {
    throw errorNoEncontrado('El rol no existe.');
  }
  await datos.actualizarRol(id, entrada);
  await datos.registrarAuditoria(actor.idUsuario, 'ROLES', 'ACTUALIZAR', 'Roles', id);
}

export const listarPermisos = () => datos.listarPermisos();

export async function asignarPermisosRol(actor, id, idsPermisos) {
  if (!Array.isArray(idsPermisos)) throw errorValidacion('Debe enviar una lista de permisos.');
  if (!(await datos.listarRoles()).some((rol) => rol.IdRol === id)) {
    throw errorNoEncontrado('El rol no existe.');
  }
  await datos.asignarPermisosRol(id, idsPermisos.map(Number));
  await datos.registrarAuditoria(actor.idUsuario, 'ROLES', 'ASIGNAR_PERMISOS', 'Roles', id, idsPermisos.join(','));
}

export const listarEmpleados = () => datos.listarEmpleados();
export const obtenerCatalogosPersonal = () => datos.listarCatalogosPersonal();

export async function obtenerEmpleado(id) {
  const empleado = await datos.obtenerEmpleado(id);
  if (!empleado) throw errorNoEncontrado('El empleado no existe.');
  return empleado;
}

export async function crearEmpleado(actor, entrada) {
  if (!entrada.idUsuario || !entrada.numeroEmpleado?.trim()) {
    throw errorValidacion('Usuario y numero de empleado son obligatorios.');
  }
  const idEmpleado = await datos.crearEmpleado(entrada);
  await datos.registrarAuditoria(actor.idUsuario, 'EMPLEADOS', 'CREAR', 'Empleados', idEmpleado);
  return obtenerEmpleado(idEmpleado);
}

export async function actualizarEmpleado(actor, id, entrada) {
  await obtenerEmpleado(id);
  if (!entrada.numeroEmpleado?.trim()) throw errorValidacion('El numero de empleado es obligatorio.');
  await datos.actualizarEmpleado(id, entrada);
  await datos.registrarAuditoria(actor.idUsuario, 'EMPLEADOS', 'ACTUALIZAR', 'Empleados', id);
  return obtenerEmpleado(id);
}

export async function cambiarEstadoEmpleado(actor, id, activo) {
  await obtenerEmpleado(id);
  await datos.cambiarEstadoEmpleado(id, activo === true);
  await datos.registrarAuditoria(actor.idUsuario, 'EMPLEADOS', 'CAMBIAR_ESTADO', 'Empleados', id, String(activo));
}

export const listarMiembros = () => datos.listarMiembrosComite();

export async function crearMiembro(actor, entrada) {
  if (!entrada.idComite || !entrada.idEmpleado || !entrada.cargo?.trim()) {
    throw errorValidacion('Comite, empleado y cargo son obligatorios.');
  }
  const idMiembro = await datos.crearMiembroComite(entrada);
  await datos.registrarAuditoria(actor.idUsuario, 'COMITE', 'AGREGAR_MIEMBRO', 'MiembrosComite', idMiembro);
  const empleado = await datos.obtenerEmpleado(Number(entrada.idEmpleado));
  await crearNotificacion(null, {
    idUsuario: empleado.IdUsuario,
    tipo: 'MEMBRESIA_COMITE',
    titulo: 'Membresia de comite asignada',
    mensaje: `Fue asignado al comite con el cargo ${entrada.cargo}.`,
    enlace: '/comite/informes'
  });
  return { idMiembro };
}

export async function desactivarMiembro(actor, id) {
  const miembro = (await datos.listarMiembrosComite()).find((item) => item.IdMiembroComite === id);
  await datos.desactivarMiembroComite(id);
  await datos.registrarAuditoria(actor.idUsuario, 'COMITE', 'DESACTIVAR_MIEMBRO', 'MiembrosComite', id);
  if (miembro) {
    const empleado = await datos.obtenerEmpleado(miembro.IdEmpleado);
    await crearNotificacion(null, {
      idUsuario: empleado.IdUsuario,
      tipo: 'MEMBRESIA_COMITE',
      titulo: 'Membresia de comite finalizada',
      mensaje: 'Su membresia activa en el comite fue finalizada.',
      enlace: '/comite/informes'
    });
  }
}

export const obtenerIndicadores = (filtros) => datos.obtenerIndicadores(validarFiltrosReporte(filtros));
export function validarFiltrosReporte(filtros = {}) {
  if (filtros.idTipoBeca !== undefined && filtros.idTipoBeca !== '') {
    const idTipo = Number(filtros.idTipoBeca);
    if (!Number.isInteger(idTipo) || idTipo <= 0) {
      throw errorValidacion('El tipo de beca seleccionado no es valido.');
    }
  }
  if (filtros.estado && !['PENDIENTE_ACTIVACION', 'ACTIVA', 'SUSPENDIDA', 'FINALIZADA', 'CANCELADA'].includes(filtros.estado)) {
    throw errorValidacion('El estado del reporte no es valido.');
  }
  return filtros;
}
export const listarBecasReporte = (filtros) => datos.listarBecasReporte(validarFiltrosReporte(filtros));
export const listarFiltrosReporte = () => datos.listarFiltrosReporte();
export const obtenerResumenRenovaciones = (filtros) => datos.obtenerResumenRenovaciones(filtros);
export async function listarActas() {
  await datos.sincronizarActasSesionesCerradas();
  return datos.listarActas();
}

export async function obtenerActa(id) {
  const acta = await datos.obtenerActa(id);
  if (!acta) throw errorNoEncontrado('El acta no existe.');
  return acta;
}

export async function generarDocumentoActa(id) {
  const acta = await obtenerActa(id);
  if (acta.IdArchivo) return { idArchivo: acta.IdArchivo, formato: 'PDF', idempotente: true };
  const lineas = [
    'SGBE - CUC',
    `Acta ${acta.NumeroActa}`,
    `Sesion: ${acta.Sesion}`,
    `Fecha: ${new Date(acta.FechaSesion).toLocaleDateString('es-CR')}`,
    '',
    acta.Contenido || 'Sin contenido registrado.'
  ];
  const contenido = crearPdfSimple(lineas);
  const idArchivo = await guardarArchivo({
    nombreOriginal: `${acta.NumeroActa}.pdf`,
    tipoMime: 'application/pdf',
    contenido
  });
  await datos.asociarArchivoActa(id, idArchivo);
  return { idArchivo, formato: 'PDF' };
}

export async function obtenerArchivoActa(id) {
  const acta = await obtenerActa(id);
  if (!acta.IdArchivo) throw errorNoEncontrado('El acta aun no tiene un documento generado.');
  const archivo = await obtenerArchivo(acta.IdArchivo);
  if (!archivo) throw errorNoEncontrado('El documento asociado al acta no existe.');
  return archivo;
}
