import { ErrorAplicacion } from '../utilidades/errorAplicacion.js';
import { enviarError } from '../utilidades/respuestas.js';
import { configuracion } from '../configuracion/variablesEntorno.js';

export function manejadorNoEncontrado(req, res) {
  enviarError(res, {
    codigo: 'RUTA_NO_ENCONTRADA',
    mensaje: 'La ruta solicitada no existe.',
    estadoHttp: 404
  });
}

// eslint-disable-next-line no-unused-vars
export function manejadorErrores(error, req, res, next) {
  if (error instanceof ErrorAplicacion) {
    return enviarError(res, {
      codigo: error.codigo,
      mensaje: error.message,
      errores: error.errores,
      estadoHttp: error.estadoHttp
    });
  }

  if (configuracion.entorno !== 'production') {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  return enviarError(res, {
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado en el servidor.',
    estadoHttp: 500
  });
}
