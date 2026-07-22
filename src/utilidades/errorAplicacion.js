export class ErrorAplicacion extends Error {
  constructor(mensaje, { codigo = 'ERROR_INTERNO', estadoHttp = 400, errores = [] } = {}) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
    this.errores = errores;
  }
}

export function errorNoEncontrado(mensaje = 'El recurso solicitado no existe.') {
  return new ErrorAplicacion(mensaje, { codigo: 'NO_ENCONTRADO', estadoHttp: 404 });
}

export function errorNoAutorizado(mensaje = 'Debe iniciar sesión para continuar.') {
  return new ErrorAplicacion(mensaje, { codigo: 'NO_AUTENTICADO', estadoHttp: 401 });
}

export function errorProhibido(mensaje = 'No tiene permiso para realizar esta acción.') {
  return new ErrorAplicacion(mensaje, { codigo: 'PROHIBIDO', estadoHttp: 403 });
}

export function errorValidacion(mensaje = 'Los datos enviados no son válidos.', errores = []) {
  return new ErrorAplicacion(mensaje, { codigo: 'VALIDACION', estadoHttp: 422, errores });
}

export function errorConflicto(mensaje = 'La operación no puede completarse en el estado actual.') {
  return new ErrorAplicacion(mensaje, { codigo: 'CONFLICTO_ESTADO', estadoHttp: 409 });
}
