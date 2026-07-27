import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioComunicaciones.js';

const rutas = Router();
rutas.use(requiereSesion);

rutas.get('/expedientes/:id/visitas', requierePermiso('VISITA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarVisitas(Number(req.params.id)) });
}));
rutas.post('/expedientes/:id/visitas', requierePermiso('VISITA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, {
    mensaje: 'Visita programada.',
    datos: await servicio.programarVisita(Number(req.params.id), req.usuario, req.body),
    estadoHttp: 201
  });
}));
rutas.put('/visitas/:id', requierePermiso('VISITA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Visita reprogramada.', datos: await servicio.reprogramarVisita(Number(req.params.id), req.usuario, req.body) });
}));
rutas.post('/visitas/:id/cancelar', requierePermiso('VISITA_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cancelarVisita(Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Visita cancelada.' });
}));
rutas.post('/visitas/:id/informe', requierePermiso('VISITA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Informe de visita registrado.', datos: await servicio.registrarInforme(Number(req.params.id), req.body) });
}));

rutas.get('/consultas', requierePermiso('CONSULTA_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarConsultasPropias(req.usuario) });
}));
rutas.post('/consultas', requierePermiso('CONSULTA_CREAR_PROPIA'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Consulta creada.', datos: await servicio.crearConsulta(req.usuario, req.body), estadoHttp: 201 });
}));
rutas.get('/consultas/:id', asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerConsulta(Number(req.params.id), req.usuario) });
}));
rutas.post('/consultas/:id/mensajes', asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Mensaje enviado.', datos: await servicio.responderConsulta(Number(req.params.id), req.usuario, req.body) });
}));
rutas.get('/trabajo-social/consultas', requierePermiso('CONSULTA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarBandeja(req.query) });
}));
rutas.put('/trabajo-social/consultas/:id/asignar', requierePermiso('CONSULTA_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.asignarConsulta(Number(req.params.id), req.usuario);
  enviarExito(res, { mensaje: 'Consulta asignada.' });
}));
rutas.put('/trabajo-social/consultas/:id/estado', requierePermiso('CONSULTA_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cambiarEstadoConsulta(Number(req.params.id), req.body.estado);
  enviarExito(res, { mensaje: 'Estado actualizado.' });
}));

rutas.get('/noticias', asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarNoticias(req.usuario) });
}));
rutas.get('/noticias/:id', asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerNoticia(Number(req.params.id), req.usuario) });
}));
rutas.post('/noticias', requierePermiso('NOTICIA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Noticia creada.', datos: await servicio.crearNoticia(req.usuario, req.body), estadoHttp: 201 });
}));
rutas.put('/noticias/:id', requierePermiso('NOTICIA_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.actualizarNoticia(Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Noticia actualizada.' });
}));
rutas.patch('/noticias/:id/estado', requierePermiso('NOTICIA_GESTIONAR'), asincrono(async (req, res) => {
  await servicio.cambiarEstadoNoticia(Number(req.params.id), req.body.estado);
  enviarExito(res, { mensaje: 'Estado de la noticia actualizado.' });
}));

export default rutas;

