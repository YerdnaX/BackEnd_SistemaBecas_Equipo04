import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorConfiguracion.js';

const rutas = Router();

rutas.use(requiereSesion, requierePermiso('CONFIGURACION_GESTIONAR'));

rutas.get('/correo', controlador.obtenerCorreo);
rutas.put('/correo', controlador.actualizarCorreo);
rutas.post('/correo/reintentar', controlador.reintentarCorreos);

rutas.get('/plantillas', controlador.listarPlantillas);
rutas.post('/plantillas', controlador.crearPlantilla);
rutas.put('/plantillas/:codigo', controlador.actualizarPlantilla);
rutas.post('/plantillas/:codigo/vista-previa', controlador.previsualizarPlantilla);

rutas.get('/parametros', controlador.listarParametros);
rutas.put('/parametros/:clave', controlador.actualizarParametro);

rutas.get('/catalogos/tipos-documento', controlador.listarTiposDocumento);
rutas.post('/catalogos/tipos-documento', controlador.crearTipoDocumento);
rutas.put('/catalogos/tipos-documento/:id', controlador.actualizarTipoDocumento);

export default rutas;
