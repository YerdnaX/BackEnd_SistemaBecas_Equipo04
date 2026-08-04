import { cerrarPool, obtenerPool } from '../src/configuracion/baseDatos.js';

try {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    UPDATE u
    SET Cedula = datos.Cedula, FechaActualizacion = SYSUTCDATETIME()
    FROM dbo.Usuarios u
    JOIN (VALUES
      (N'admin.pruebas@cuc.ac.cr', '101010101'),
      (N'coordinador.pruebas@cuc.ac.cr', '202020202'),
      (N'trabajosocial.pruebas@cuc.ac.cr', '303030303'),
      (N'comite.pruebas@cuc.ac.cr', '404040404'),
      (N'finanzas.pruebas@cuc.ac.cr', '505050505'),
      (N'registroacademico.pruebas@cuc.ac.cr', '606060606')
    ) datos(Correo, Cedula) ON datos.Correo = u.Correo
    WHERE u.Cedula IS NULL;
    SELECT @@ROWCOUNT AS Actualizados;
  `);
  console.log(`Cedulas de personal de prueba completadas: ${resultado.recordset[0].Actualizados}.`);
} finally {
  await cerrarPool();
}
