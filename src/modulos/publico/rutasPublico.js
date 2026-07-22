import { Router } from 'express';
import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { errorNoEncontrado } from '../../utilidades/errorAplicacion.js';
import * as datos from './accesoDatosPublico.js';

const rutas = Router();

rutas.get('/inicio', asincrono(async (req, res) => {
  const [convocatorias, noticias] = await Promise.all([
    datos.listarConvocatoriasPublicadas({ limite: 3 }),
    datos.listarNoticiasPublicadas({ limite: 3 })
  ]);
  enviarExito(res, { datos: { convocatoriasDestacadas: convocatorias, noticiasRecientes: noticias } });
}));

rutas.get('/convocatorias', asincrono(async (req, res) => {
  const convocatorias = await datos.listarConvocatoriasPublicadas();
  enviarExito(res, { datos: convocatorias });
}));

rutas.get('/convocatorias/:id', asincrono(async (req, res) => {
  const convocatoria = await datos.obtenerConvocatoriaPublicaPorId(Number(req.params.id));
  if (!convocatoria) throw errorNoEncontrado('La convocatoria no existe o no está disponible.');
  enviarExito(res, { datos: convocatoria });
}));

rutas.get('/noticias', asincrono(async (req, res) => {
  const noticias = await datos.listarNoticiasPublicadas();
  enviarExito(res, { datos: noticias });
}));

export default rutas;
