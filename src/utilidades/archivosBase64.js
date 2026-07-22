import { errorValidacion } from './errorAplicacion.js';

export function decodificarArchivoBase64(contenidoBase64) {
  if (!contenidoBase64 || typeof contenidoBase64 !== 'string') {
    throw errorValidacion('Debe adjuntar un archivo válido.');
  }
  const coincidencia = contenidoBase64.match(/^data:(.+);base64,(.*)$/);
  const datos = coincidencia ? coincidencia[2] : contenidoBase64;
  return Buffer.from(datos, 'base64');
}
