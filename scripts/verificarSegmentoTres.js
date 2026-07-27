import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';

const verificaciones = [
  {
    nombre: 'Columna EnviosCorreo.ContenidoHtml',
    consulta: `
      SELECT CASE WHEN COL_LENGTH('dbo.EnviosCorreo', 'ContenidoHtml') IS NULL THEN 0 ELSE 1 END AS Cumple
    `
  },
  {
    nombre: 'Permisos base del Segmento 03',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 10 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.Permisos
      WHERE Codigo IN (
        'APELACION_CREAR_PROPIA','APELACION_LISTAR','APELACION_ASIGNAR','APELACION_RESOLVER',
        'DISCIPLINARIO_GESTIONAR','DESCARGO_CREAR_PROPIO','EXPEDIENTE_CERRAR',
        'CONFIGURACION_GESTIONAR','AUDITORIA_VER','CHATBOT_GESTIONAR'
      )
    `
  },
  {
    nombre: 'Rol BECADO con permisos de apelacion/descargo',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.RolesPermisos rp
      JOIN dbo.Roles r ON r.IdRol = rp.IdRol
      JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
      WHERE r.Codigo = 'BECADO'
        AND p.Codigo IN ('APELACION_CREAR_PROPIA','DESCARGO_CREAR_PROPIO')
    `
  },
  {
    nombre: 'Rol TRABAJADORA_SOCIAL con permisos operativos de Segmento 03',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 6 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.RolesPermisos rp
      JOIN dbo.Roles r ON r.IdRol = rp.IdRol
      JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
      WHERE r.Codigo = 'TRABAJADORA_SOCIAL'
        AND p.Codigo IN ('APELACION_LISTAR','APELACION_ASIGNAR','APELACION_RESOLVER','DISCIPLINARIO_GESTIONAR','EXPEDIENTE_CERRAR','CHATBOT_GESTIONAR')
    `
  },
  {
    nombre: 'Rol COORDINADOR_BECAS con visibilidad de apelaciones/auditoria',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.RolesPermisos rp
      JOIN dbo.Roles r ON r.IdRol = rp.IdRol
      JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
      WHERE r.Codigo = 'COORDINADOR_BECAS'
        AND p.Codigo IN ('APELACION_LISTAR','AUDITORIA_VER')
    `
  },
  {
    nombre: 'Parametros de Segmento 03',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 5 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.ConfiguracionesSistema
      WHERE Clave IN (
        'APELACION_PLAZO_DIAS','SUSPENSION_PLAZO_DESCARGOS_DIAS','CHATBOT_MAXIMO_RESULTADOS',
        'CORREO_REMITENTE_NOMBRE','NOTIFICACION_REINTENTOS_MAXIMOS'
      )
    `
  },
  {
    nombre: 'Plantillas transaccionales del Segmento 03',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 3 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.PlantillasMensajes
      WHERE Codigo IN ('APELACION_RESUELTA','INVESTIGACION_ABIERTA','INVESTIGACION_RESUELTA')
    `
  }
];

let fallidas = 0;
try {
  const pool = await obtenerPool();
  for (const verificacion of verificaciones) {
    const resultado = await pool.request().query(verificacion.consulta);
    const cumple = Boolean(resultado.recordset[0]?.Cumple);
    if (!cumple) fallidas += 1;
    console.log(`${cumple ? 'OK' : 'PENDIENTE'} - ${verificacion.nombre}`);
  }
} finally {
  await cerrarPool();
}

if (fallidas) {
  console.error(`${fallidas} verificacion(es) requieren aplicar la migracion del Segmento 03.`);
  process.exitCode = 1;
}
