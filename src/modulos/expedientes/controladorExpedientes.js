import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import * as servicio from './servicioExpedientes.js';

export const listar = asincrono(async (req, res) => {
  const { estado, idConvocatoria, idEmpleadoResponsable, pagina } = req.query;
  const expedientes = await servicio.listarExpedientes({
    estado,
    idConvocatoria: idConvocatoria ? Number(idConvocatoria) : undefined,
    idEmpleadoResponsable: idEmpleadoResponsable ? Number(idEmpleadoResponsable) : undefined,
    pagina: pagina ? Number(pagina) : 1
  });
  enviarExito(res, { datos: expedientes });
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

export const enviarComite = asincrono(async (req, res) => {
  const expediente = await servicio.enviarComite(Number(req.params.id), req.usuario.idUsuario);
  enviarExito(res, { mensaje: 'Expediente enviado al comité.', datos: expediente });
});
