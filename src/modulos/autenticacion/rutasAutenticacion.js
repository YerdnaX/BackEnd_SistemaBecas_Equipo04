import { Router } from 'express';
import { limitadorAutenticacion } from '../../middleware/limitadorTasa.js';
import * as controlador from './controladorAutenticacion.js';

const rutas = Router();

rutas.post('/registro', limitadorAutenticacion, controlador.registro);
rutas.post('/verificar-registro', limitadorAutenticacion, controlador.verificarRegistro);
rutas.post('/iniciar-sesion', limitadorAutenticacion, controlador.iniciarSesion);
rutas.post('/verificar-dos-factores', limitadorAutenticacion, controlador.verificarDosFactores);
rutas.post('/renovar-sesion', controlador.renovarSesion);
rutas.post('/cerrar-sesion', controlador.cerrarSesion);
rutas.post('/recuperar-contrasena', limitadorAutenticacion, controlador.recuperarContrasena);
rutas.post('/verificar-codigo-recuperacion', limitadorAutenticacion, controlador.verificarCodigoRecuperacion);
rutas.post('/restablecer-contrasena', limitadorAutenticacion, controlador.restablecerContrasena);

export default rutas;
