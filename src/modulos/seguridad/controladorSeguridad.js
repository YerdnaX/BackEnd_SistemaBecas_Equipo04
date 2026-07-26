import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioSeguridad.js';

export const auditoria = asincrono(async (req, res) => {
  const { modulo, idUsuario, pagina } = req.query;
  const datos = await servicio.listarAuditoria({
    modulo,
    idUsuario: idUsuario ? Number(idUsuario) : undefined,
    pagina: pagina ? Number(pagina) : 1
  });
  enviarExito(res, { datos });
});

export const eventos = asincrono(async (req, res) => {
  const { nivel, pagina } = req.query;
  const datos = await servicio.listarEventosSeguridad({ nivel, pagina: pagina ? Number(pagina) : 1 });
  enviarExito(res, { datos });
});

export const sesionesActivas = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarSesionesActivas() });
});

export const revocarSesionAdmin = asincrono(async (req, res) => {
  const resultado = await servicio.revocarSesionAdministrativa(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Sesión revocada.', datos: resultado });
});

export const misSesiones = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarSesionesPropias(req.usuario.idUsuario) });
});

export const revocarMiSesion = asincrono(async (req, res) => {
  const resultado = await servicio.revocarSesionPropia(Number(req.params.id), req.usuario);
  enviarExito(res, { mensaje: 'Sesión revocada.', datos: resultado });
});
