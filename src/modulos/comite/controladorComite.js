import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioComite.js';

export const listarExpedientesDisponibles = asincrono(async (req, res) => {
  const idConvocatoria = req.query.idConvocatoria ? Number(req.query.idConvocatoria) : undefined;
  const expedientes = await servicio.listarExpedientesDisponibles(idConvocatoria);
  enviarExito(res, { datos: expedientes });
});

export const crearSesion = asincrono(async (req, res) => {
  const sesion = await servicio.crearSesion(req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Sesión de comité creada.', datos: sesion, estadoHttp: 201 });
});

export const obtenerSesion = asincrono(async (req, res) => {
  const sesion = await servicio.obtenerSesion(Number(req.params.id));
  enviarExito(res, { datos: sesion });
});

export const registrarDecision = asincrono(async (req, res) => {
  const sesion = await servicio.registrarDecision(
    Number(req.params.id), Number(req.params.idExpediente), req.body, req.usuario.idUsuario
  );
  enviarExito(res, { mensaje: 'Decisión registrada.', datos: sesion });
});

export const cerrarSesion = asincrono(async (req, res) => {
  const sesion = await servicio.cerrarSesion(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Sesión cerrada y resultados publicados.', datos: sesion });
});
