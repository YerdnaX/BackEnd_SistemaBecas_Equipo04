import { asincrono } from '../../utilidades/asincrono.js';
import { enviarExito } from '../../utilidades/respuestas.js';
import { decodificarArchivoBase64 } from '../../utilidades/archivosBase64.js';
import * as servicio from './servicioSolicitudes.js';

export const crear = asincrono(async (req, res) => {
  const solicitud = await servicio.crearSolicitud(req.usuario.idUsuario, Number(req.body.idConvocatoria));
  enviarExito(res, { mensaje: 'Solicitud creada en borrador.', datos: solicitud, estadoHttp: 201 });
});

export const obtener = asincrono(async (req, res) => {
  const solicitud = await servicio.obtenerSolicitud(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: solicitud });
});

export const guardarDatosPersonales = asincrono(async (req, res) => {
  const solicitud = await servicio.guardarDatosPersonales(Number(req.params.id), req.usuario, req.body);
  enviarExito(res, { mensaje: 'Datos personales guardados.', datos: solicitud });
});

export const guardarDatosAcademicos = asincrono(async (req, res) => {
  const solicitud = await servicio.guardarDatosAcademicos(Number(req.params.id), req.usuario, req.body);
  enviarExito(res, { mensaje: 'Datos académicos guardados.', datos: solicitud });
});

export const guardarDatosSocioeconomicos = asincrono(async (req, res) => {
  const solicitud = await servicio.guardarDatosSocioeconomicos(Number(req.params.id), req.usuario, req.body);
  enviarExito(res, { mensaje: 'Datos socioeconómicos guardados.', datos: solicitud });
});

export const listarDocumentos = asincrono(async (req, res) => {
  const documentos = await servicio.listarDocumentos(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: documentos });
});

export const agregarDocumento = asincrono(async (req, res) => {
  const contenido = decodificarArchivoBase64(req.body.contenidoBase64);
  const resultado = await servicio.agregarDocumento(Number(req.params.id), req.usuario, {
    idRequisito: req.body.idRequisito ? Number(req.body.idRequisito) : null,
    idTipoDocumento: req.body.idTipoDocumento ? Number(req.body.idTipoDocumento) : null,
    nombreOriginal: req.body.nombreArchivo,
    tipoMime: req.body.tipoMime,
    contenido
  });
  enviarExito(res, { mensaje: 'Documento cargado.', datos: resultado, estadoHttp: 201 });
});

export const eliminarDocumento = asincrono(async (req, res) => {
  await servicio.eliminarDocumento(Number(req.params.id), Number(req.params.idDocumento), req.usuario);
  enviarExito(res, { mensaje: 'Documento eliminado.' });
});

export const obtenerArchivoDocumento = asincrono(async (req, res) => {
  const archivo = await servicio.obtenerArchivoDocumento(Number(req.params.id), Number(req.params.idDocumento), req.usuario);
  enviarExito(res, {
    datos: {
      nombreOriginal: archivo.NombreOriginal,
      tipoMime: archivo.TipoMime,
      contenidoBase64: `data:${archivo.TipoMime};base64,${archivo.Contenido.toString('base64')}`
    }
  });
});

export const validacion = asincrono(async (req, res) => {
  const resultado = await servicio.validarSolicitud(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: resultado });
});

export const enviar = asincrono(async (req, res) => {
  const resultado = await servicio.enviarSolicitud(Number(req.params.id), req.usuario);
  enviarExito(res, { mensaje: 'Solicitud enviada correctamente.', datos: resultado });
});

export const resultado = asincrono(async (req, res) => {
  const datosResultado = await servicio.obtenerResultado(Number(req.params.id), req.usuario);
  enviarExito(res, { datos: datosResultado });
});
