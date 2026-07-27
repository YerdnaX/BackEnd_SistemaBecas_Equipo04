import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioDisciplinario.js';

export const abrir = asincrono(async (req, res) => {
  const investigacion = await servicio.abrirInvestigacion(Number(req.params.idBecaActiva), req.body, req.usuario);
  enviarExito(res, { mensaje: 'Proceso disciplinario abierto.', datos: investigacion, estadoHttp: 201 });
});

export const listar = asincrono(async (req, res) => {
  const { estado, pagina } = req.query;
  const investigaciones = await servicio.listarInvestigaciones({ estado, pagina: pagina ? Number(pagina) : 1 }, req.usuario);
  enviarExito(res, { datos: investigaciones });
});

export const obtener = asincrono(async (req, res) => {
  const investigacion = await servicio.obtenerInvestigacion(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: investigacion });
});

export const presentarDescargo = asincrono(async (req, res) => {
  const investigacion = await servicio.presentarDescargo(Number(req.params.id), req.body, req.usuario);
  enviarExito(res, { mensaje: 'Descargo presentado.', datos: investigacion });
});

export const pasarAAnalisis = asincrono(async (req, res) => {
  const investigacion = await servicio.pasarAAnalisis(Number(req.params.id), req.usuario);
  enviarExito(res, { mensaje: 'Proceso pasado a análisis.', datos: investigacion });
});

export const resolver = asincrono(async (req, res) => {
  const investigacion = await servicio.resolverInvestigacion(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Proceso resuelto.', datos: investigacion });
});
