import { Router } from 'express';
import { limitadorAutenticacion } from '../../middleware/limitadorTasa.js';
import * as controlador from './controladorAutenticacion.js';

const rutas = Router();

rutas.post('/registro', limitadorAutenticacion, controlador.registro);
rutas.post('/activar', limitadorAutenticacion, controlador.activar);
rutas.post('/reenviar-activacion', limitadorAutenticacion, controlador.reenviarActivacion);
rutas.post('/iniciar-sesion', limitadorAutenticacion, controlador.iniciarSesion);
rutas.post('/verificar-2fa', limitadorAutenticacion, controlador.verificarDosFactores);
rutas.post('/reenviar-2fa', limitadorAutenticacion, controlador.reenviarDosFactores);
rutas.post('/renovar-sesion', controlador.renovarSesion);
rutas.post('/cerrar-sesion', controlador.cerrarSesion);
rutas.post('/recuperar-contrasena', limitadorAutenticacion, controlador.recuperarContrasena);
rutas.post('/restablecer-contrasena', limitadorAutenticacion, controlador.restablecerContrasena);

export default rutas;
