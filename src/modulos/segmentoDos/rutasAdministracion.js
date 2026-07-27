import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { parametroIdPositivo } from '../../utilidades/parametrosRuta.js';
import * as servicio from './servicioAdministracion.js';

const rutas = Router();
rutas.use(requiereSesion);
rutas.param('id', parametroIdPositivo);

function serializarArchivo(archivo) {
  return {
    nombreOriginal: archivo.NombreOriginal,
    tipoMime: archivo.TipoMime,
    contenidoBase64: `data:${archivo.TipoMime};base64,${archivo.Contenido.toString('base64')}`
  };
}

rutas.get('/usuarios', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarUsuarios(req.query) })));
rutas.post('/usuarios', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Usuario creado.', datos: await servicio.crearUsuario(req.usuario, req.body), estadoHttp: 201 })));
rutas.get('/usuarios/:id', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerUsuario(Number(req.params.id)) })));
rutas.put('/usuarios/:id', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Usuario actualizado.', datos: await servicio.actualizarUsuario(req.usuario, Number(req.params.id), req.body) })));
rutas.patch('/usuarios/:id/estado', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cambiarEstadoUsuario(req.usuario, Number(req.params.id), req.body.estado);
  enviarExito(res, { mensaje: 'Estado de usuario actualizado.' });
}));
rutas.put('/usuarios/:id/roles', requierePermiso('USUARIO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Roles asignados.', datos: await servicio.asignarRoles(req.usuario, Number(req.params.id), req.body.idsRoles) })));

rutas.get('/roles', requierePermiso('ROL_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarRoles() })));
rutas.post('/roles', requierePermiso('ROL_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Rol creado.', datos: await servicio.crearRol(req.usuario, req.body), estadoHttp: 201 })));
rutas.put('/roles/:id', requierePermiso('ROL_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.actualizarRol(req.usuario, Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Rol actualizado.' });
}));
rutas.get('/permisos', requierePermiso('ROL_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarPermisos() })));
rutas.put('/roles/:id/permisos', requierePermiso('ROL_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.asignarPermisosRol(req.usuario, Number(req.params.id), req.body.idsPermisos);
  enviarExito(res, { mensaje: 'Permisos asignados.' });
}));

rutas.get('/empleados', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarEmpleados() })));
rutas.get('/empleados/catalogos', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerCatalogosPersonal() })));
rutas.post('/empleados', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Empleado creado.', datos: await servicio.crearEmpleado(req.usuario, req.body), estadoHttp: 201 })));
rutas.get('/empleados/:id', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerEmpleado(Number(req.params.id)) })));
rutas.put('/empleados/:id', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Empleado actualizado.', datos: await servicio.actualizarEmpleado(req.usuario, Number(req.params.id), req.body) })));
rutas.patch('/empleados/:id/estado', requierePermiso('EMPLEADO_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cambiarEstadoEmpleado(req.usuario, Number(req.params.id), req.body.activo);
  enviarExito(res, { mensaje: 'Estado de empleado actualizado.' });
}));

rutas.get('/comite/miembros', requierePermiso('COMITE_MIEMBRO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarMiembros() })));
rutas.post('/comite/miembros', requierePermiso('COMITE_MIEMBRO_GESTIONAR'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Miembro agregado.', datos: await servicio.crearMiembro(req.usuario, req.body), estadoHttp: 201 })));
rutas.delete('/comite/miembros/:id', requierePermiso('COMITE_MIEMBRO_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.desactivarMiembro(req.usuario, Number(req.params.id));
  enviarExito(res, { mensaje: 'Membresia desactivada.' });
}));

rutas.get('/reportes/filtros', requierePermiso('REPORTE_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarFiltrosReporte() })));
rutas.get('/reportes/indicadores', requierePermiso('REPORTE_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerIndicadores(req.query) })));
rutas.get('/reportes/becas', requierePermiso('REPORTE_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarBecasReporte(req.query) })));
rutas.get('/reportes/renovaciones', requierePermiso('REPORTE_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerResumenRenovaciones(req.query) })));
rutas.get('/comite/actas', requierePermiso('ACTA_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.listarActas() })));
rutas.get('/comite/actas/:id', requierePermiso('ACTA_VER'), asincrono(async (req, res) => enviarExito(res, { datos: await servicio.obtenerActa(Number(req.params.id)) })));
rutas.post('/comite/actas/:id/generar-documento', requierePermiso('ACTA_VER'), asincrono(async (req, res) => enviarExito(res, { mensaje: 'Documento de acta generado.', datos: await servicio.generarDocumentoActa(Number(req.params.id)) })));
rutas.get('/comite/actas/:id/archivo', requierePermiso('ACTA_VER'), asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoActa(Number(req.params.id));
  enviarExito(res, { datos: serializarArchivo(archivo) });
}));

export default rutas;
