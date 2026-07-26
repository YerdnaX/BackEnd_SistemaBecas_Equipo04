import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorApelaciones.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.post('/resoluciones/:idResolucion', requierePermiso('APELACION_CREAR_PROPIA'), controlador.presentar);
rutas.get('/', controlador.listar);
rutas.get('/:id', controlador.obtener);
rutas.post('/:id/asignar', requierePermiso('APELACION_ASIGNAR'), controlador.asignar);
rutas.post('/:id/resolver', requierePermiso('APELACION_RESOLVER'), controlador.resolver);

export default rutas;
