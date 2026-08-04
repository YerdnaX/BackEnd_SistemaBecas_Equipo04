import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioExpedientes.js';

export const listar = asincrono(async (req, res) => {
  const { estado, idConvocatoria, idEmpleadoResponsable, periodo, pagina } = req.query;
  const expedientes = await servicio.listarExpedientes({
    estado,
    idConvocatoria: idConvocatoria ? Number(idConvocatoria) : undefined,
    idEmpleadoResponsable: idEmpleadoResponsable ? Number(idEmpleadoResponsable) : undefined,
    periodo,
    pagina: pagina ? Number(pagina) : 1
  });
  enviarExito(res, { datos: expedientes });
});

export const listarPeriodos = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.listarPeriodosExpedientes() });
});

export const obtener = asincrono(async (req, res) => {
  const expediente = await servicio.obtenerExpediente(Number(req.params.id));
  enviarExito(res, { datos: expediente });
});

export const asignar = asincrono(async (req, res) => {
  const expediente = await servicio.asignarExpediente(Number(req.params.id), Number(req.body.idEmpleado), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Expediente asignado.', datos: expediente });
});

export const revisarDocumento = asincrono(async (req, res) => {
  const expediente = await servicio.revisarDocumento(
    Number(req.params.id), Number(req.params.idDocumento), req.body, req.usuario.idUsuario
  );
  enviarExito(res, { mensaje: 'Revisión registrada.', datos: expediente });
});

export const obtenerArchivoDocumento = asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoDocumentoExpediente(Number(req.params.id), Number(req.params.idDocumento));
  const contenidoBase64 = archivo.Contenido
    ? `data:${archivo.TipoMime};base64,${archivo.Contenido.toString('base64')}`
    : null;
  enviarExito(res, {
    datos: {
      nombreOriginal: archivo.NombreOriginal,
      tipoMime: archivo.TipoMime,
      contenidoBase64,
      urlExterna: archivo.UrlExterna || null
    }
  });
});

export const solicitarSubsanacion = asincrono(async (req, res) => {
  const expediente = await servicio.solicitarSubsanacion(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Subsanación solicitada.', datos: expediente });
});

export const elegibilidad = asincrono(async (req, res) => {
  const expediente = await servicio.resolverElegibilidad(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Elegibilidad registrada.', datos: expediente });
});

export const obtenerEvaluacion = asincrono(async (req, res) => {
  const evaluacion = await servicio.obtenerEvaluacion(Number(req.params.id));
  enviarExito(res, { datos: evaluacion });
});

export const guardarEvaluacion = asincrono(async (req, res) => {
  const expediente = await servicio.guardarEvaluacion(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Evaluación registrada.', datos: expediente });
});

export const guardarEvaluacionAutomatica = asincrono(async (req, res) => {
  const expediente = await servicio.guardarEvaluacionAutomatica(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Evaluacion automatica registrada.', datos: expediente });
});

export const obtenerInformeSocial = asincrono(async (req, res) => {
  enviarExito(res, { datos: await servicio.obtenerInformeSocial(Number(req.params.id)) });
});

export const guardarInformeSocial = asincrono(async (req, res) => {
  const informe = await servicio.guardarInformeSocial(Number(req.params.id), req.body, req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Informe social guardado.', datos: informe });
});

export const enviarComite = asincrono(async (req, res) => {
  const expediente = await servicio.enviarComite(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Expediente enviado al comité.', datos: expediente });
});
