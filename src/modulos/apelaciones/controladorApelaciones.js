import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioApelaciones.js';

export const presentar = asincrono(async (req, res) => {
  const apelacion = await servicio.presentarApelacion(Number(req.params.idResolucion), req.body, req.usuario);
  enviarExito(res, { mensaje: 'Apelación presentada correctamente.', datos: apelacion, estadoHttp: 201 });
});

export const listar = asincrono(async (req, res) => {
  const { estado, pagina } = req.query;
  const apelaciones = await servicio.listarApelaciones({ estado, pagina: pagina ? Number(pagina) : 1 }, req.usuario);
  enviarExito(res, { datos: apelaciones });
});

export const obtener = asincrono(async (req, res) => {
  const apelacion = await servicio.obtenerApelacion(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: apelacion });
});

export const asignar = asincrono(async (req, res) => {
  const apelacion = await servicio.asignarRevisorApelacion(Number(req.params.id), Number(req.body.idRevisor), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Revisor asignado.', datos: apelacion });
});

export const resolver = asincrono(async (req, res) => {
  const apelacion = await servicio.resolverApelacion(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Apelación resuelta.', datos: apelacion });
});
