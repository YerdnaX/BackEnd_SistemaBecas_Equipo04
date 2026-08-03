import { configuracion } from '../configuracion/variablesEntorno.js';
import { ErrorAplicacion, errorNoEncontrado, errorValidacion } from '../utilidades/errorAplicacion.js';

/**
 * Normaliza y valida el formato de una cedula fisica costarricense: solo
 * digitos, exactamente 9 (sin guiones ni espacios almacenados ni enviados
 * al proveedor externo).
 */
export function validarFormatoCedula(cedula) {
  const normalizada = String(cedula ?? '').replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(normalizada)) {
    throw errorValidacion('La cédula debe contener exactamente 9 dígitos numéricos.', [
      { campo: 'cedula', mensaje: 'La cédula debe contener exactamente 9 dígitos numéricos.' }
    ]);
  }
  return normalizada;
}

function proveedorConfigurado() {
  return Boolean(configuracion.consultaCedula.apiKey);
}

// El proveedor devuelve el nombre completo en un solo campo. Se asume el
// orden costarricense habitual nombre(s) + primer apellido + segundo
// apellido: la ultima palabra es el segundo apellido, la penultima el
// primer apellido, y el resto (una o mas palabras) es el nombre. Ajustar
// aqui si el proveedor cambia a campos separados.
function partirNombreCompleto(nombreCompleto) {
  const partes = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: '', primerApellido: '', segundoApellido: '' };
  if (partes.length === 1) return { nombre: partes[0], primerApellido: '', segundoApellido: '' };
  if (partes.length === 2) return { nombre: partes[0], primerApellido: partes[1], segundoApellido: '' };
  const segundoApellido = partes[partes.length - 1];
  const primerApellido = partes[partes.length - 2];
  const nombre = partes.slice(0, partes.length - 2).join(' ');
  return { nombre, primerApellido, segundoApellido };
}

/**
 * Consulta el padron externo por cedula. Nunca expone al llamador el
 * detalle tecnico del proveedor (respuesta cruda, encabezados, stacktrace);
 * solo se usan los campos de nombre para precargar un formulario, no se
 * persiste la respuesta completa.
 */
export async function consultarCedula(cedula) {
  const cedulaNormalizada = validarFormatoCedula(cedula);

  if (!proveedorConfigurado()) {
    throw new ErrorAplicacion(
      'La verificación automática de cédulas no está configurada en el servidor.',
      { codigo: 'CONSULTA_CEDULA_NO_CONFIGURADA', estadoHttp: 503 }
    );
  }

  const controladorTiempo = new AbortController();
  const temporizador = setTimeout(() => controladorTiempo.abort(), configuracion.consultaCedula.timeoutMs);

  let respuesta;
  try {
    respuesta = await fetch(`${configuracion.consultaCedula.urlBase}/${cedulaNormalizada}`, {
      method: 'GET',
      headers: { 'X-Api-Key': configuracion.consultaCedula.apiKey },
      signal: controladorTiempo.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ErrorAplicacion('No fue posible validar la cédula en este momento. Intente de nuevo más tarde.', {
        codigo: 'CONSULTA_CEDULA_TIEMPO_AGOTADO',
        estadoHttp: 503
      });
    }
    throw new ErrorAplicacion('No fue posible validar la cédula en este momento. Intente de nuevo más tarde.', {
      codigo: 'CONSULTA_CEDULA_SIN_CONEXION',
      estadoHttp: 503
    });
  } finally {
    clearTimeout(temporizador);
  }

  if (respuesta.status === 404) {
    throw errorNoEncontrado('No se encontró información para esa cédula.');
  }

  if (!respuesta.ok) {
    throw new ErrorAplicacion('No fue posible validar la cédula en este momento. Intente de nuevo más tarde.', {
      codigo: 'CONSULTA_CEDULA_ERROR_PROVEEDOR',
      estadoHttp: 503
    });
  }

  const datos = await respuesta.json().catch(() => null);
  const nombreCompleto = datos?.nombre || datos?.nombreCompleto || datos?.razonSocial;
  if (!datos || !nombreCompleto) {
    throw errorNoEncontrado('No se encontró información para esa cédula.');
  }

  return partirNombreCompleto(nombreCompleto);
}
