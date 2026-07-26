import { Router } from 'express';
import { requiereSesion } from '../../middleware/autenticacion.js';
import { requierePermiso } from '../../middleware/autorizacion.js';
import * as controlador from './controladorChatbot.js';

const rutas = Router();

// Publico: no requiere sesion.
rutas.post('/consultar', controlador.consultar);
rutas.get('/categorias', controlador.categorias);

// Gestion de la base de conocimiento: requiere sesion y permiso.
rutas.get('/entradas', requiereSesion, requierePermiso('CHATBOT_GESTIONAR'), controlador.listar);
rutas.post('/entradas', requiereSesion, requierePermiso('CHATBOT_GESTIONAR'), controlador.crear);
rutas.put('/entradas/:id', requiereSesion, requierePermiso('CHATBOT_GESTIONAR'), controlador.actualizar);
rutas.delete('/entradas/:id', requiereSesion, requierePermiso('CHATBOT_GESTIONAR'), controlador.eliminar);

export default rutas;
