import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioConvocatorias.js';

export const listar = asincrono(async (req, res) => {
  const { estado, idTipoBeca, pagina } = req.query;
  const convocatorias = await servicio.listarConvocatorias({
    estado,
    idTipoBeca: idTipoBeca ? Number(idTipoBeca) : undefined,
    pagina: pagina ? Number(pagina) : 1
  });
  enviarExito(res, { datos: convocatorias });
});

export const obtener = asincrono(async (req, res) => {
  const convocatoria = await servicio.obtenerConvocatoria(Number(req.params.id));
  enviarExito(res, { datos: convocatoria });
});

export const crear = asincrono(async (req, res) => {
  const convocatoria = await servicio.crearConvocatoria(req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Convocatoria creada en borrador.', datos: convocatoria, estadoHttp: 201 });
});

export const actualizar = asincrono(async (req, res) => {
  const convocatoria = await servicio.actualizarConvocatoria(Number(req.params.id), req.body);
  enviarExito(res, { mensaje: 'Convocatoria actualizada.', datos: convocatoria });
});

export const enviarAprobacion = asincrono(async (req, res) => {
  const convocatoria = await servicio.enviarAprobacion(Number(req.params.id));
  enviarExito(res, { mensaje: 'Convocatoria enviada a aprobación.', datos: convocatoria });
});

export const aprobar = asincrono(async (req, res) => {
  const convocatoria = await servicio.aprobarConvocatoria(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Convocatoria aprobada.', datos: convocatoria });
});

export const publicar = asincrono(async (req, res) => {
  const convocatoria = await servicio.publicarConvocatoria(Number(req.params.id));
  enviarExito(res, { mensaje: 'Convocatoria publicada.', datos: convocatoria });
});

export const listarEtapas = asincrono(async (req, res) => {
  const etapas = await servicio.listarEtapas(Number(req.params.id));
  enviarExito(res, { datos: etapas });
});

export const actualizarEtapa = asincrono(async (req, res) => {
  const etapa = await servicio.actualizarEtapa(
    Number(req.params.id),
    Number(req.params.idEtapa),
    req.body,
    req.usuario.idUsuario
  );
  enviarExito(res, { mensaje: 'Etapa actualizada.', datos: etapa });
});
