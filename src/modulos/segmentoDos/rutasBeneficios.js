import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso, requiereRol } from '../../middleware/autorizacion.js';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioBeneficios.js';

const rutas = Router();
rutas.use(requiereSesion);

rutas.get('/solicitudes/:id/formalizacion', requierePermiso('FORMALIZACION_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerFormalizacion(Number(req.params.id), req.usuario) });
}));
rutas.post('/solicitudes/:id/formalizacion/aceptar', requierePermiso('FORMALIZACION_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, {
    mensaje: 'Condiciones aceptadas correctamente.',
    datos: await servicio.aceptarCondiciones(Number(req.params.id), req.usuario, req.body, req.ip)
  });
}));
rutas.get('/solicitudes/:id/convenio', requierePermiso('FORMALIZACION_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerConvenio(Number(req.params.id), req.usuario) });
}));
rutas.post('/solicitudes/:id/convenio/confirmar', requierePermiso('FORMALIZACION_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, {
    mensaje: 'Convenio confirmado.',
    datos: await servicio.confirmarConvenio(Number(req.params.id), req.usuario, req.body, req.ip)
  });
}));

rutas.get('/beneficios/:id', requiereRol('FINANZAS', 'REGISTRO_ACADEMICO', 'TRABAJADORA_SOCIAL', 'ADMINISTRADOR'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerBeneficio(Number(req.params.id)) });
}));
rutas.post('/beneficios/:id/validacion-academica', requierePermiso('VALIDACION_ACADEMICA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Validacion academica registrada.', datos: await servicio.validarAcademicamente(Number(req.params.id), req.usuario, req.body) });
}));
rutas.post('/beneficios/:id/activacion-financiera', requierePermiso('ACTIVACION_FINANCIERA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Aplicacion financiera registrada.', datos: await servicio.activarFinancieramente(Number(req.params.id), req.usuario, req.body) });
}));
rutas.post('/beneficios/:id/verificar-aplicacion', requierePermiso('ACTIVACION_FINANCIERA_GESTIONAR'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Beneficio activado.', datos: await servicio.verificarAplicacion(Number(req.params.id)) });
}));

rutas.get('/becado/panel', requierePermiso('BECADO_VER_PROPIO'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerPanel(req.usuario) });
}));
rutas.get('/becado/expediente', requierePermiso('BECADO_VER_PROPIO'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerExpediente(req.usuario) });
}));
rutas.put('/becado/expediente', requierePermiso('BECADO_EDITAR_PROPIO'), asincrono(async (req, res) => {
  enviarExito(res, { mensaje: 'Expediente actualizado.', datos: await servicio.actualizarExpediente(req.usuario, req.body) });
}));
rutas.get('/becado/expediente/historial', requierePermiso('BECADO_VER_PROPIO'), asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarHistorialExpediente(req.usuario) });
}));

export default rutas;

