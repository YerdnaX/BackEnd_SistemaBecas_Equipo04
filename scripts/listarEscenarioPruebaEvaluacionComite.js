import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';

try {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT e.IdExpediente, e.CodigoExpediente, e.Estado,
      CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Aspirante,
      c.Periodo, pq.Quintil,
      CASE WHEN i.IdInformeSocial IS NULL THEN 0 ELSE 1 END AS TieneInformeSocial,
      CASE WHEN ev.IdEvaluacion IS NULL THEN 0 ELSE 1 END AS TieneEvaluacion
    FROM dbo.Expedientes e
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
    LEFT JOIN dbo.PrecalculosQuintil pq ON pq.IdExpediente = e.IdExpediente
    LEFT JOIN dbo.InformesSocialesExpediente i ON i.IdExpediente = e.IdExpediente
    OUTER APPLY (
      SELECT TOP 1 IdEvaluacion FROM dbo.EvaluacionesExpediente ev
      WHERE ev.IdExpediente = e.IdExpediente ORDER BY ev.IdEvaluacion DESC
    ) ev
    ORDER BY e.IdExpediente
  `);
  console.table(resultado.recordset);
  const sesiones = await pool.request().query(`
    SELECT IdSesionComite, Nombre, Estado
    FROM dbo.SesionesComite
    WHERE Estado = 'ABIERTA'
    ORDER BY IdSesionComite DESC
  `);
  console.table(sesiones.recordset);
} finally {
  await cerrarPool();
}
