import jwt from 'jsonwebtoken';
import { configuracion } from '../configuracion/variablesEntorno.js';
import { errorNoAutorizado } from '../utilidades/errorAplicacion.js';
import { asincrono } from '../utilidades/asincrono.js';

export const requiereSesion = asincrono(async (req, res, next) => {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  if (!token) {
    throw errorNoAutorizado('Debe iniciar sesión para continuar.');
  }

  try {
    const cargaUtil = jwt.verify(token, configuracion.jwt.secreto);
    req.usuario = {
      idUsuario: cargaUtil.idUsuario,
      correo: cargaUtil.correo,
      roles: cargaUtil.roles || [],
      permisos: cargaUtil.permisos || []
    };
    next();
  } catch {
    throw errorNoAutorizado('La sesión no es válida o expiró.');
  }
});

export function sesionOpcional(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;
  if (!token) return next();
  try {
    const cargaUtil = jwt.verify(token, configuracion.jwt.secreto);
    req.usuario = {
      idUsuario: cargaUtil.idUsuario,
      correo: cargaUtil.correo,
      roles: cargaUtil.roles || [],
      permisos: cargaUtil.permisos || []
    };
  } catch {
    // token invalido en ruta opcional: se continua como visitante
  }
  next();
}
