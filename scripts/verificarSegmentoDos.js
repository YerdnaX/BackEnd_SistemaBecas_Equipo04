import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';
import * as administracion from '../src/modulos/segmentoDos/accesoDatosAdministracion.js';
import * as beneficios from '../src/modulos/segmentoDos/accesoDatosBeneficios.js';
import * as comunicaciones from '../src/modulos/segmentoDos/accesoDatosComunicaciones.js';
import * as seguimiento from '../src/modulos/segmentoDos/accesoDatosSeguimiento.js';

const verificaciones = [
  {
    nombre: 'Renovaciones unicas por beneficio y periodo',
    consulta: `
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM dbo.RenovacionesBeca
        GROUP BY IdBecaActiva, Periodo HAVING COUNT(*) > 1
      ) THEN 0 ELSE 1 END AS Cumple
    `
  },
  {
    nombre: 'Indice unico de renovaciones',
    consulta: `
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.RenovacionesBeca')
          AND is_unique = 1
          AND name = 'UQ_RenovacionesBeca_BecaPeriodo'
      ) THEN 1 ELSE 0 END AS Cumple
    `
  },
  {
    nombre: 'Parametros de permanencia',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.ConfiguracionesSistema
      WHERE Clave IN ('PROMEDIO_MINIMO_PERMANENCIA','CREDITOS_MINIMOS_PERMANENCIA')
    `
  },
  {
    nombre: 'Trabajo Social puede gestionar noticias',
    consulta: `
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM dbo.RolesPermisos rp
        JOIN dbo.Roles r ON r.IdRol = rp.IdRol
        JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
        WHERE r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo = 'NOTICIA_GESTIONAR'
      ) THEN 1 ELSE 0 END AS Cumple
    `
  },
  {
    nombre: 'Plantillas transaccionales del Segmento 2',
    consulta: `
      SELECT CASE WHEN COUNT(*) = 14 THEN 1 ELSE 0 END AS Cumple
      FROM dbo.PlantillasMensajes
      WHERE Codigo IN (
        'FORMALIZACION_COMPLETADA','VALIDACION_ACADEMICA','APLICACION_FINANCIERA',
        'ACTIVACION_FINANCIERA_FALLIDA','BENEFICIO_ACTIVO','VISITA_PROGRAMADA',
        'VISITA_MODIFICADA','VISITA_CANCELADA','CONSULTA_RESPONDIDA',
        'ALERTA_SEGUIMIENTO','JUSTIFICACION_RESUELTA','RENOVACION_ABIERTA',
        'RENOVACION_ENVIADA','RENOVACION_RESUELTA'
      )
    `
  },
  {
    nombre: 'Catalogos de puestos y departamentos',
    consulta: `
      SELECT CASE WHEN
        (SELECT COUNT(*) FROM dbo.Puestos WHERE Activo = 1) >= 4
        AND (SELECT COUNT(*) FROM dbo.Departamentos WHERE Activo = 1) >= 4
      THEN 1 ELSE 0 END AS Cumple
    `
  },
  {
    nombre: 'Sesiones cerradas con acta',
    consulta: `
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.SesionesComite s
        WHERE s.Estado = 'CERRADA'
          AND NOT EXISTS (
            SELECT 1 FROM dbo.ActasComite a
            WHERE a.IdSesionComite = s.IdSesionComite
          )
      ) THEN 0 ELSE 1 END AS Cumple
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

  const [usuarios, consultas, catalogos, indicadores, listaBeneficios, renovaciones] = await Promise.all([
    administracion.listarUsuarios({ buscar: '', estado: '', pagina: 1, limite: 5, desplazamiento: 0 }),
    comunicaciones.listarConsultasTrabajoSocial({ estado: '', buscar: '', pagina: 1, limite: 5, desplazamiento: 0 }),
    administracion.listarFiltrosReporte(),
    administracion.obtenerIndicadores({}),
    beneficios.listarBeneficios(),
    seguimiento.listarRenovaciones({})
  ]);
  console.log(`OK - Consultas operativas: ${usuarios.total} usuarios, ${consultas.total} consultas, ${listaBeneficios.length} beneficios, ${renovaciones.length} renovaciones.`);
  console.log(`OK - Reportes operativos: ${catalogos.periodos.length} periodos, ${Number(indicadores.TotalSolicitudes || 0)} solicitudes.`);
} finally {
  await cerrarPool();
}

if (fallidas) {
  console.error(`${fallidas} verificacion(es) requieren aplicar la migracion del Segmento 2.`);
  process.exitCode = 1;
}
