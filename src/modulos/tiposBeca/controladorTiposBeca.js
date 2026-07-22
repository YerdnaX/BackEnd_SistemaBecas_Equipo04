import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioTiposBeca.js';

export const listar = asincrono(async (req, res) => {
  const soloActivos = req.query.activos === 'true';
  const tiposBeca = await servicio.listarTiposBeca(soloActivos);
  enviarExito(res, { datos: tiposBeca });
});

export const obtener = asincrono(async (req, res) => {
  const tipoBeca = await servicio.obtenerTipoBeca(Number(req.params.id));
  enviarExito(res, { datos: tipoBeca });
});

export const crear = asincrono(async (req, res) => {
  const tipoBeca = await servicio.crearTipoBeca(req.body);
  enviarExito(res, { mensaje: 'Tipo de beca creado.', datos: tipoBeca, estadoHttp: 201 });
});

export const actualizar = asincrono(async (req, res) => {
  const tipoBeca = await servicio.actualizarTipoBeca(Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Tipo de beca actualizado.', datos: tipoBeca });
});

export const cambiarEstado = asincrono(async (req, res) => {
  const tipoBeca = await servicio.cambiarEstadoTipoBeca(Number(req.params.id), Boolean(req.body.activo));
  enviarExito(res, { mensaje: 'Estado actualizado.', datos: tipoBeca });
});
