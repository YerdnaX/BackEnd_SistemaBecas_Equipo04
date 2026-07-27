import { obtenerPool, sql } from '../configuracion/baseDatos.js';
import { enviarCorreo } from './servicioCorreo.js';

function reemplazarVariables(texto, variables) {
  return String(texto).replace(/\{\{\s*(\w+)\s*\}\}/g, (coincidencia, clave) => {
    return Object.prototype.hasOwnProperty.call(variables, clave) ? String(variables[clave]) : coincidencia;
  });
}

async function obtenerPlantilla(codigo) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('codigo', sql.NVarChar(60), codigo)
    .query('SELECT * FROM dbo.PlantillasMensajes WHERE Codigo = @codigo AND Activo = 1');
  return resultado.recordset[0] || null;
}

async function obtenerUsuario(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idUsuario)
    .query('SELECT IdUsuario, Correo, Nombre FROM dbo.Usuarios WHERE IdUsuario = @id');
  return resultado.recordset[0] || null;
}

// Idempotencia simple: si ya existe un envio ENVIADO con el mismo destino, tipo
// de mensaje y asunto en la ultima hora, no se reenvia. Evita duplicar
// notificaciones cuando una accion se reintenta por error de red del cliente.
async function yaSeEnvioRecientemente(correoDestino, tipoMensaje, asunto) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('correoDestino', sql.NVarChar(150), correoDestino)
    .input('tipoMensaje', sql.NVarChar(60), tipoMensaje)
    .input('asunto', sql.NVarChar(200), asunto)
    .query(`
      SELECT TOP 1 IdEnvioCorreo FROM dbo.EnviosCorreo
      WHERE CorreoDestino = @correoDestino AND TipoMensaje = @tipoMensaje AND Asunto = @asunto
        AND Estado = 'ENVIADO' AND FechaEnvio >= DATEADD(HOUR, -1, SYSUTCDATETIME())
    `);
  return resultado.recordset.length > 0;
}

export async function enviarNotificacionPlantilla(codigoPlantilla, idUsuario, variables = {}) {
  const plantilla = await obtenerPlantilla(codigoPlantilla);
  const usuario = await obtenerUsuario(idUsuario);
  if (!plantilla || !usuario) return { enviado: false, motivo: 'PLANTILLA_O_USUARIO_INEXISTENTE' };

  const asunto = reemplazarVariables(plantilla.Asunto, variables);
  const contenidoHtml = reemplazarVariables(plantilla.Contenido, variables);

  const duplicado = await yaSeEnvioRecientemente(usuario.Correo, codigoPlantilla, asunto);
  if (duplicado) return { enviado: false, motivo: 'DUPLICADO_IDEMPOTENTE' };

  const resultadoEnvio = await enviarCorreo({
    idUsuario,
    correoDestino: usuario.Correo,
    asunto,
    tipoMensaje: codigoPlantilla,
    contenidoHtml
  });
  return resultadoEnvio;
}

export function renderizarPlantillaPreliminar(plantilla, variables = {}) {
  return {
    asunto: reemplazarVariables(plantilla.Asunto, variables),
    contenidoHtml: reemplazarVariables(plantilla.Contenido, variables)
  };
}
