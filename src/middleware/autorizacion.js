import { errorProhibido } from '../utilidades/errorAplicacion.js';

export function requierePermiso(codigoPermiso) {
  return (req, res, next) => {
    const permisos = req.usuario?.permisos || [];
    if (!permisos.includes(codigoPermiso)) {
      throw errorProhibido('No tiene permiso para realizar esta acción.');
    }
    next();
  };
}

export function requiereRol(...codigosRol) {
  return (req, res, next) => {
    const roles = req.usuario?.roles || [];
    if (!roles.some((rol) => codigosRol.includes(rol))) {
      throw errorProhibido('No tiene permiso para realizar esta acción.');
    }
    next();
  };
}
