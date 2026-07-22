import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorSolicitudes.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.post('/', requierePermiso('SOLICITUD_CREAR'), controlador.crear);
rutas.get('/:id', controlador.obtener);
rutas.put('/:id/datos-personales', requierePermiso('SOLICITUD_EDITAR_PROPIA'), controlador.guardarDatosPersonales);
rutas.put('/:id/datos-academicos', requierePermiso('SOLICITUD_EDITAR_PROPIA'), controlador.guardarDatosAcademicos);
rutas.put('/:id/datos-socioeconomicos', requierePermiso('SOLICITUD_EDITAR_PROPIA'), controlador.guardarDatosSocioeconomicos);
rutas.get('/:id/documentos', controlador.listarDocumentos);
rutas.post('/:id/documentos', requierePermiso('DOCUMENTO_CARGAR_PROPIO'), controlador.agregarDocumento);
rutas.delete('/:id/documentos/:idDocumento', requierePermiso('DOCUMENTO_CARGAR_PROPIO'), controlador.eliminarDocumento);
rutas.get('/:id/documentos/:idDocumento/archivo', controlador.obtenerArchivoDocumento);
rutas.get('/:id/validacion', controlador.validacion);
rutas.post('/:id/enviar', requierePermiso('SOLICITUD_ENVIAR_PROPIA'), controlador.enviar);
rutas.get('/:id/resultado', requierePermiso('RESULTADO_VER_PROPIO'), controlador.resultado);

export default rutas;
