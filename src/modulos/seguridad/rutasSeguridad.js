import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorSeguridad.js';

const rutas = Router();

rutas.use(requiereSesion);

// Seguridad de la cuenta propia: cualquier usuario autenticado.
rutas.get('/mis-sesiones', controlador.misSesiones);
rutas.delete('/mis-sesiones/:id', controlador.revocarMiSesion);

// Auditoria y monitoreo administrativo: requiere permiso explicito.
rutas.get('/auditoria', requierePermiso('AUDITORIA_VER'), controlador.auditoria);
rutas.get('/eventos', requierePermiso('AUDITORIA_VER'), controlador.eventos);
rutas.get('/sesiones', requierePermiso('AUDITORIA_VER'), controlador.sesionesActivas);
rutas.delete('/sesiones/:id', requierePermiso('AUDITORIA_VER'), controlador.revocarSesionAdmin);

export default rutas;
