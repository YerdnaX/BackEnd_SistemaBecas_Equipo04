import { errorValidacion, errorNoEncontrado } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosTiposBeca.js';

function validarDatosTipoBeca({ nombre, porcentajeCobertura }) {
  const errores = [];
  if (!nombre?.trim()) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
  const porcentaje = Number(porcentajeCobertura);
  if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    errores.push({ campo: 'porcentajeCobertura', mensaje: 'El porcentaje de cobertura debe estar entre 0 y 100.' });
  }
  if (errores.length > 0) throw errorValidacion('Revise los datos del tipo de beca.', errores);
}

export async function listarTiposBeca(soloActivos) {
  return datos.listarTiposBeca({ soloActivos });
}

export async function obtenerTipoBeca(idTipoBeca) {
  const tipoBeca = await datos.obtenerTipoBecaPorId(idTipoBeca);
  if (!tipoBeca) throw errorNoEncontrado('El tipo de beca no existe.');
  return tipoBeca;
}

export async function crearTipoBeca(datosEntrada) {
  validarDatosTipoBeca(datosEntrada);
  const idTipoBeca = await datos.crearTipoBeca(datosEntrada);
  return obtenerTipoBeca(idTipoBeca);
}

export async function actualizarTipoBeca(idTipoBeca, datosEntrada) {
  validarDatosTipoBeca(datosEntrada);
  await obtenerTipoBeca(idTipoBeca);
  await datos.actualizarTipoBeca(idTipoBeca, datosEntrada);
  return obtenerTipoBeca(idTipoBeca);
}

export async function cambiarEstadoTipoBeca(idTipoBeca, activo) {
  await obtenerTipoBeca(idTipoBeca);
  await datos.cambiarEstadoTipoBeca(idTipoBeca, activo);
  return obtenerTipoBeca(idTipoBeca);
}
