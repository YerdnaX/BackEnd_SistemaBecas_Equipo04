import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorComite.js';

const rutas = Router();

rutas.use(requiereSesion);

rutas.get('/expedientes', requierePermiso('COMITE_SESIONAR'), controlador.listarExpedientesDisponibles);
rutas.get('/sesiones', requierePermiso('COMITE_SESIONAR'), controlador.listarSesiones);
rutas.post('/sesiones', requierePermiso('COMITE_SESIONAR'), controlador.crearSesion);
rutas.get('/sesiones/:id', requierePermiso('COMITE_SESIONAR'), controlador.obtenerSesion);
rutas.post('/sesiones/:id/casos/:idExpediente/voto', requierePermiso('COMITE_RESOLVER'), controlador.registrarVoto);
rutas.post('/sesiones/:id/cerrar', requierePermiso('COMITE_RESOLVER'), controlador.cerrarSesion);

export default rutas;
