import { Router } from 'express';
import { limitadorAsistente } from '../../middleware/limitadorTasa.js';
import * as controlador from './controladorAsistente.js';

const rutas = Router();

// Publico: el boton de chat debe funcionar con o sin sesion iniciada.
// El id de conversacion es un UUID propio (no un entero de base de datos),
// por eso no usa el validador parametroIdPositivo de los demas modulos.
rutas.use(limitadorAsistente);

rutas.post('/conversaciones', controlador.iniciar);
rutas.post('/conversaciones/:id/mensajes', controlador.enviarMensaje);

export default rutas;
