import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';

const tablasEsperadas = [
  'UmbralesQuintilCostaRica',
  'PrecalculosQuintil',
  'InformesSocialesExpediente',
  'MiembrosSesionComite',
  'VotosComite'
];

try {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT
      SUM(CASE WHEN t.name IN ('UmbralesQuintilCostaRica','PrecalculosQuintil','InformesSocialesExpediente','MiembrosSesionComite','VotosComite') THEN 1 ELSE 0 END) AS Tablas,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Convocatorias') AND name = 'Periodo') AS ColumnaPeriodo,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.EvaluacionesExpediente') AND name IN ('Origen','QuintilCalculado')) AS ColumnasEvaluacion,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DecisionesComite') AND name = 'EsGrupal') AS ColumnaDecisionGrupal,
      (SELECT COUNT(*) FROM dbo.Permisos WHERE Codigo IN ('INFORME_SOCIAL_GESTIONAR','INFORME_SOCIAL_VER')) AS Permisos,
      (SELECT COUNT(*) FROM dbo.UmbralesQuintilCostaRica WHERE AnioReferencia = 2025 AND Activo = 1) AS UmbralNacional
    FROM sys.tables t
  `);
  const fila = resultado.recordset[0];
  const valida = Number(fila.Tablas) === tablasEsperadas.length
    && Number(fila.ColumnaPeriodo) === 1
    && Number(fila.ColumnasEvaluacion) === 2
    && Number(fila.ColumnaDecisionGrupal) === 1
    && Number(fila.Permisos) === 2
    && Number(fila.UmbralNacional) === 1;
  if (!valida) {
    throw new Error(`Estructura incompleta: ${JSON.stringify(fila)}`);
  }
  console.log('Actualizacion de evaluacion y comite verificada correctamente.');

  const datos = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Convocatorias WHERE Periodo IS NULL OR LTRIM(RTRIM(Periodo)) = '') AS ConvocatoriasSinPeriodo,
      (SELECT COUNT(*)
       FROM dbo.MiembrosComite m
       JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado AND e.Activo = 1
       WHERE m.Activo = 1 AND m.FechaInicio <= SYSUTCDATETIME()
         AND (m.FechaFin IS NULL OR m.FechaFin > SYSUTCDATETIME())) AS MiembrosVigentes
  `);
  const estado = datos.recordset[0];
  console.log(`Datos actuales: ${estado.ConvocatoriasSinPeriodo} convocatoria(s) sin periodo y ${estado.MiembrosVigentes} miembro(s) vigente(s) de comite.`);
} finally {
  await cerrarPool();
}
