import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorConvocatorias.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.get('/', requierePermiso('CONVOCATORIA_VER'), controlador.listar);
rutas.get('/:id', requierePermiso('CONVOCATORIA_VER'), controlador.obtener);
rutas.post('/', requierePermiso('CONVOCATORIA_CREAR'), controlador.crear);
rutas.put('/:id', requierePermiso('CONVOCATORIA_EDITAR'), controlador.actualizar);
rutas.post('/:id/enviar-aprobacion', requierePermiso('CONVOCATORIA_EDITAR'), controlador.enviarAprobacion);
rutas.post('/:id/aprobar', requierePermiso('CONVOCATORIA_APROBAR'), controlador.aprobar);
rutas.post('/:id/publicar', requierePermiso('CONVOCATORIA_PUBLICAR'), controlador.publicar);
rutas.get('/:id/etapas', requierePermiso('CONVOCATORIA_VER'), controlador.listarEtapas);
rutas.put('/:id/etapas/:idEtapa', requierePermiso('ETAPA_GESTIONAR'), controlador.actualizarEtapa);

export default rutas;
