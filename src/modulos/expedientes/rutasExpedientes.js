import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorExpedientes.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.get('/', requierePermiso('EXPEDIENTE_LISTAR'), controlador.listar);
rutas.get('/:id', requierePermiso('EXPEDIENTE_LISTAR'), controlador.obtener);
rutas.post('/:id/asignar', requierePermiso('EXPEDIENTE_ASIGNAR'), controlador.asignar);
rutas.put('/:id/documentos/:idDocumento/revision', requierePermiso('DOCUMENTO_REVISAR'), controlador.revisarDocumento);
rutas.post('/:id/solicitar-subsanacion', requierePermiso('DOCUMENTO_REVISAR'), controlador.solicitarSubsanacion);
rutas.post('/:id/elegibilidad', requierePermiso('ELEGIBILIDAD_RESOLVER'), controlador.elegibilidad);
rutas.get('/:id/evaluacion', requierePermiso('EVALUACION_REGISTRAR'), controlador.obtenerEvaluacion);
rutas.post('/:id/evaluacion', requierePermiso('EVALUACION_REGISTRAR'), controlador.guardarEvaluacion);
rutas.post('/:id/enviar-comite', requierePermiso('EVALUACION_REGISTRAR'), controlador.enviarComite);

export default rutas;
