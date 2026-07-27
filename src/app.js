import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { configuracion } from './configuracion/variablesEntorno.js';
import { manejadorErrores, manejadorNoEncontrado } from './middleware/manejadorErrores.js';
import { enviarExito } from './utilidades/respuestas.js';

import rutasPublico from './modulos/publico/rutasPublico.js';
import rutasAutenticacion from './modulos/autenticacion/rutasAutenticacion.js';
import rutasUsuarios from './modulos/usuarios/rutasUsuarios.js';
import rutasTiposBeca from './modulos/tiposBeca/rutasTiposBeca.js';
import rutasConvocatorias from './modulos/convocatorias/rutasConvocatorias.js';
import rutasAspirante from './modulos/aspirante/rutasAspirante.js';
import rutasSolicitudes from './modulos/solicitudes/rutasSolicitudes.js';
import rutasExpedientes from './modulos/expedientes/rutasExpedientes.js';
import rutasComite from './modulos/comite/rutasComite.js';
import rutasNotificaciones from './modulos/notificaciones/rutasNotificaciones.js';
import rutasBeneficios from './modulos/segmentoDos/rutasBeneficios.js';
import rutasComunicaciones from './modulos/segmentoDos/rutasComunicaciones.js';
import rutasSeguimiento from './modulos/segmentoDos/rutasSeguimiento.js';
import rutasAdministracion from './modulos/segmentoDos/rutasAdministracion.js';
import rutasApelaciones from './modulos/apelaciones/rutasApelaciones.js';
import rutasDisciplinario from './modulos/disciplinario/rutasDisciplinario.js';
import rutasCierre from './modulos/cierre/rutasCierre.js';
import rutasConfiguracion from './modulos/configuracion-sistema/rutasConfiguracion.js';
import rutasSeguridad from './modulos/seguridad/rutasSeguridad.js';
import rutasChatbot from './modulos/chatbot/rutasChatbot.js';

export function crearAplicacion() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: configuracion.urlFrontend, credentials: true }));
  app.use(express.json({ limit: '15mb' }));

  app.get('/', (req, res) => {
    enviarExito(res, {
      mensaje: 'API SGBE en línea.',
      datos: {
        servicio: 'api-becas',
        version: 'v1',
        salud: '/api/salud'
      }
    });
  });

  app.get('/api/salud', (req, res) => {
    enviarExito(res, {
      mensaje: 'Servicio disponible.',
      datos: { servicio: 'api-becas', estado: 'disponible' }
    });
  });

  const enrutadorV1 = express.Router();
  enrutadorV1.use('/publico', rutasPublico);
  enrutadorV1.use('/autenticacion', rutasAutenticacion);
  enrutadorV1.use('/usuarios', rutasUsuarios);
  enrutadorV1.use('/tipos-beca', rutasTiposBeca);
  enrutadorV1.use('/convocatorias', rutasConvocatorias);
  enrutadorV1.use('/aspirante', rutasAspirante);
  enrutadorV1.use('/solicitudes', rutasSolicitudes);
  enrutadorV1.use('/expedientes', rutasExpedientes);
  enrutadorV1.use('/comite', rutasComite);
  enrutadorV1.use('/notificaciones', rutasNotificaciones);
  enrutadorV1.use(rutasBeneficios);
  enrutadorV1.use(rutasComunicaciones);
  enrutadorV1.use(rutasSeguimiento);
  enrutadorV1.use(rutasAdministracion);
  enrutadorV1.use('/apelaciones', rutasApelaciones);
  enrutadorV1.use('/disciplinario', rutasDisciplinario);
  enrutadorV1.use('/expedientes', rutasCierre);
  enrutadorV1.use('/configuracion', rutasConfiguracion);
  enrutadorV1.use('/seguridad', rutasSeguridad);
  enrutadorV1.use('/chatbot', rutasChatbot);

  app.use('/api/v1', enrutadorV1);

  app.use(manejadorNoEncontrado);
  app.use(manejadorErrores);

  return app;
}
