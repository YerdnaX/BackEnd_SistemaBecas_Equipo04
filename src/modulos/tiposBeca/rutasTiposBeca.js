import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorTiposBeca.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.get('/', requierePermiso('TIPO_BECA_VER'), controlador.listar);
rutas.get('/:id', requierePermiso('TIPO_BECA_VER'), controlador.obtener);
rutas.post('/', requierePermiso('TIPO_BECA_CREAR'), controlador.crear);
rutas.put('/:id', requierePermiso('TIPO_BECA_EDITAR'), controlador.actualizar);
rutas.patch('/:id/estado', requierePermiso('TIPO_BECA_EDITAR'), controlador.cambiarEstado);

export default rutas;
