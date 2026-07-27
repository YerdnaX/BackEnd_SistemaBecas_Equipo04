import { errorValidacion } from './errorAplicacion.js';

export const CAMPOS_EXPEDIENTE_EDITABLES = Object.freeze([
  'telefono',
  'direccion',
  'contactoEmergencia',
  'telefonoEmergencia',
  'situacionLaboral',
  'observaciones'
]);

export const CAMPOS_EXPEDIENTE_SENSIBLES = Object.freeze([
  'direccion',
  'situacionLaboral'
]);

export function filtrarActualizacionesExpediente(datos = {}) {
  return Object.fromEntries(
    Object.entries(datos).filter(([campo]) => CAMPOS_EXPEDIENTE_EDITABLES.includes(campo))
  );
}

export function esActualizacionSensible(campo) {
  return CAMPOS_EXPEDIENTE_SENSIBLES.includes(campo);
}

export function validarProgramacionVisita(fechaProgramada, ahora = new Date()) {
  const fecha = new Date(fechaProgramada);
  if (!fechaProgramada || Number.isNaN(fecha.getTime())) {
    throw errorValidacion('La fecha programada no es valida.');
  }
  if (fecha <= ahora) {
    throw errorValidacion('La visita debe programarse en una fecha futura.');
  }
  return fecha;
}

export function evaluarPermanencia(
  { promedio, creditosAprobados },
  { promedioMinimo = 70, creditosMinimos = 9 } = {}
) {
  const motivos = [];
  if (Number(promedio) < Number(promedioMinimo)) motivos.push('PROMEDIO_BAJO');
  if (Number(creditosAprobados) < Number(creditosMinimos)) motivos.push('CREDITOS_INSUFICIENTES');
  return { cumple: motivos.length === 0, motivos };
}

export function validarResultadoRenovacion(resultado, porcentajeNuevo) {
  const resultados = ['RENOVADA', 'REDUCIDA', 'SUSPENDIDA', 'DENEGADA'];
  if (!resultados.includes(resultado)) {
    throw errorValidacion('El resultado de renovacion no es valido.');
  }
  if (['RENOVADA', 'REDUCIDA'].includes(resultado)) {
    const porcentaje = Number(porcentajeNuevo);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      throw errorValidacion('El porcentaje de la renovacion debe estar entre 0 y 100.');
    }
  }
}

export function validarEnvioRenovacion({
  estado,
  enviar,
  datosActualizados = {},
  cantidadDocumentos = 0
}) {
  if (estado !== 'BORRADOR') {
    if (enviar && estado === 'EN_REEVALUACION') return { idempotente: true };
    throw errorValidacion('Solo se puede modificar una renovacion en borrador.');
  }
  if (enviar && datosActualizados.declaracion !== true) {
    throw errorValidacion('Debe aceptar la declaracion de veracidad antes de enviar.');
  }
  if (enviar && Number(cantidadDocumentos) < 1) {
    throw errorValidacion('Debe adjuntar al menos un documento de respaldo antes de enviar.');
  }
  return { idempotente: false };
}

export function normalizarEstadoConsulta(estado) {
  const normalizado = estado === 'EN_ATENCION' ? 'RESPONDIDA' : estado;
  if (!['ABIERTA', 'RESPONDIDA', 'CERRADA'].includes(normalizado)) {
    throw errorValidacion('El estado no es valido.');
  }
  return normalizado;
}

export function obtenerPaginacion(consulta = {}) {
  const pagina = Math.max(1, Number.parseInt(consulta.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, Number.parseInt(consulta.limite, 10) || 20));
  return { pagina, limite, desplazamiento: (pagina - 1) * limite };
}
