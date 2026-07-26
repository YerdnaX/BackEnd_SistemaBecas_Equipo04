import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorCierre.js';

const rutas = Router({ mergeParams: true });

rutas.use(requiereSesion, requierePermiso('EXPEDIENTE_CERRAR'));

rutas.get('/:id/cierre', controlador.verificar);
rutas.post('/:id/cierre', controlador.cerrar);

export default rutas;
