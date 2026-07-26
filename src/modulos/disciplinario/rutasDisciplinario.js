import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorDisciplinario.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.post('/becas/:idBecaActiva', requierePermiso('DISCIPLINARIO_GESTIONAR'), controlador.abrir);
rutas.get('/', controlador.listar);
rutas.get('/:id', controlador.obtener);
rutas.post('/:id/descargos', controlador.presentarDescargo);
rutas.post('/:id/analisis', requierePermiso('DISCIPLINARIO_GESTIONAR'), controlador.pasarAAnalisis);
rutas.post('/:id/resolver', requierePermiso('DISCIPLINARIO_GESTIONAR'), controlador.resolver);

export default rutas;
