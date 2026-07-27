import { cerrarPool, obtenerPool, sql } from '../src/configuracion/baseDatos.js';

const periodo = 'RENOVACION-PRUEBA-SEG2';

try {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('periodo', sql.NVarChar(30), periodo)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.PeriodosRenovacion WHERE Periodo = @periodo)
        UPDATE dbo.PeriodosRenovacion
        SET FechaInicio = DATEADD(DAY, -1, SYSUTCDATETIME()),
          FechaFin = DATEADD(DAY, 30, SYSUTCDATETIME()),
          Activo = 1
        WHERE Periodo = @periodo;
      ELSE
        INSERT INTO dbo.PeriodosRenovacion (Periodo, FechaInicio, FechaFin, Activo)
        VALUES (
          @periodo,
          DATEADD(DAY, -1, SYSUTCDATETIME()),
          DATEADD(DAY, 30, SYSUTCDATETIME()),
          1
        );

      SELECT IdPeriodoRenovacion, Periodo, FechaInicio, FechaFin, Activo
      FROM dbo.PeriodosRenovacion WHERE Periodo = @periodo;
    `);
  console.table(resultado.recordset);
} finally {
  await cerrarPool();
}
