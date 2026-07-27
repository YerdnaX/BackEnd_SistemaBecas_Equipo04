import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { decodificarArchivoBase64 } from '../../utilidades/archivosBase64.js';
import { parametroIdPositivo } from '../../utilidades/parametrosRuta.js';
import * as servicio from './servicioSeguimiento.js';

const rutas = Router();
rutas.use(requiereSesion);
rutas.param('id', parametroIdPositivo);
rutas.param('idDocumento', parametroIdPositivo);

function prepararArchivo(cuerpo) {
  if (!cuerpo?.contenidoBase64) return null;
  return {
    nombreOriginal: cuerpo.nombreArchivo,
    tipoMime: cuerpo.tipoMime,
    contenido: decodificarArchivoBase64(cuerpo.contenidoBase64)
  };
}

function serializarArchivo(archivo) {
  return {
    nombreOriginal: archivo.NombreOriginal,
    tipoMime: archivo.TipoMime,
    contenidoBase64: `data:${archivo.TipoMime};base64,${archivo.Contenido.toString('base64')}`
  };
}

rutas.get('/becarios/:id/seguimientos', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarSeguimientos(Number(req.params.id)) });
}));
rutas.post('/becarios/:id/seguimientos', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Seguimiento registrado.', datos: await servicio.registrarSeguimiento(Number(req.params.id), req.usuario, req.body), estadoHttp: 201 });
}));
rutas.post('/becarios/:id/rendimientos', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Rendimiento registrado.', datos: await servicio.registrarRendimiento(Number(req.params.id), req.usuario, req.body), estadoHttp: 201 });
}));
rutas.get('/becarios/:id/alertas', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarAlertas(Number(req.params.id)) });
}));
rutas.post('/becarios/:id/alertas', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Alerta creada.', datos: await servicio.crearAlerta(Number(req.params.id), req.body), estadoHttp: 201 });
}));
rutas.put('/alertas/:id/cerrar', requierePermiso('SEGUIMIENTO_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cerrarAlerta(Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Alerta cerrada.' });
}));

rutas.get('/becado/justificaciones', requierePermiso('JUSTIFICACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarJustificaciones(req.usuario) });
}));
rutas.post('/becado/justificaciones', requierePermiso('JUSTIFICACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, {
    mensaje: 'Justificacion enviada a revision.',
    datos: await servicio.crearJustificacion(req.usuario, { ...req.body, archivo: prepararArchivo(req.body) }),
    estadoHttp: 201
  });
}));
rutas.get('/trabajo-social/justificaciones', requierePermiso('JUSTIFICACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarJustificacionesTrabajoSocial(req.query) });
}));
rutas.get('/justificaciones/:id', asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerJustificacion(Number(req.params.id), req.usuario) });
}));
rutas.get('/justificaciones/:id/archivo', asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoJustificacion(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: serializarArchivo(archivo) });
}));
rutas.put('/justificaciones/:id/resolver', requierePermiso('JUSTIFICACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Justificacion resuelta.', datos: await servicio.resolverJustificacion(Number(req.params.id), req.usuario, req.body) });
}));

rutas.get('/becado/renovaciones/disponibilidad', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.disponibilidadRenovacion(req.usuario) });
}));
rutas.get('/becado/renovaciones/:id', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerRenovacion(Number(req.params.id), req.usuario) });
}));
rutas.post('/becado/renovaciones', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Renovacion creada.', datos: await servicio.crearRenovacion(req.usuario, req.body), estadoHttp: 201 });
}));
rutas.put('/becado/renovaciones/:id', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: req.body.enviar ? 'Renovacion enviada.' : 'Borrador guardado.', datos: await servicio.actualizarRenovacion(Number(req.params.id), req.usuario, req.body) });
}));
rutas.post('/becado/renovaciones/:id/documentos', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, {
    mensaje: 'Documento agregado.',
    datos: await servicio.agregarDocumentoRenovacion(Number(req.params.id), req.usuario, { ...req.body, archivo: prepararArchivo(req.body) }),
    estadoHttp: 201
  });
}));
rutas.get('/becado/renovaciones/:id/documentos/:idDocumento/archivo', requierePermiso('RENOVACION_CREAR_PROPIA'), asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoRenovacion(
    Number(req.params.id),
    Number(req.params.idDocumento),
    req.usuario
  );
  enviarExito(res, { datos: serializarArchivo(archivo) });
}));
rutas.get('/trabajo-social/renovaciones', requierePermiso('RENOVACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarRenovacionesTrabajoSocial(req.query) });
}));
rutas.get('/trabajo-social/renovaciones/:id', requierePermiso('RENOVACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerRenovacion(Number(req.params.id), req.usuario) });
}));
rutas.get('/trabajo-social/renovaciones/:id/documentos/:idDocumento/archivo', requierePermiso('RENOVACION_RESOLVER'), asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoRenovacion(
    Number(req.params.id),
    Number(req.params.idDocumento),
    req.usuario
  );
  enviarExito(res, { datos: serializarArchivo(archivo) });
}));
rutas.put('/trabajo-social/renovaciones/:id/evaluar', requierePermiso('RENOVACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Renovacion evaluada.', datos: await servicio.evaluarRenovacion(Number(req.params.id), req.usuario, req.body) });
}));
rutas.put('/trabajo-social/renovaciones/:id/resolver', requierePermiso('RENOVACION_RESOLVER'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Renovacion resuelta.', datos: await servicio.resolverRenovacion(Number(req.params.id), req.usuario, req.body) });
}));

export default rutas;
