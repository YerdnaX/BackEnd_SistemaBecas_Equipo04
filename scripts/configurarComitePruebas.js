import { cerrarPool, obtenerPool, sql } from '../src/configuracion/baseDatos.js';

const integrantes = [
  { correo: 'admin.pruebas@cuc.ac.cr', numero: 'EMP-COMITE-001', cargo: 'Presidencia' },
  { correo: 'coordinador.pruebas@cuc.ac.cr', numero: 'EMP-COMITE-002', cargo: 'Secretaria' },
  { correo: 'comite.pruebas@cuc.ac.cr', numero: 'EMP-COMITE-003', cargo: 'Vocalia' }
];

const pool = await obtenerPool();
const transaccion = new sql.Transaction(pool);
let transaccionActiva = false;

try {
  await transaccion.begin();
  transaccionActiva = true;
  const cuentas = await transaccion.request().query(`
    SELECT IdUsuario, Correo FROM dbo.Usuarios
    WHERE Correo IN ('admin.pruebas@cuc.ac.cr','coordinador.pruebas@cuc.ac.cr','comite.pruebas@cuc.ac.cr')
  `);
  if (cuentas.recordset.length !== integrantes.length) {
    const encontrados = new Set(cuentas.recordset.map((cuenta) => cuenta.Correo.toLowerCase()));
    const faltantes = integrantes.filter((item) => !encontrados.has(item.correo)).map((item) => item.correo);
    throw new Error(`No se configuraron membresias. Faltan estas cuentas: ${faltantes.join(', ')}`);
  }

  const catalogos = await transaccion.request().query(`
    SELECT
      (SELECT TOP 1 IdPuesto FROM dbo.Puestos WHERE Activo = 1 ORDER BY CASE WHEN Nombre = N'Administrativo' THEN 0 ELSE 1 END, IdPuesto) AS IdPuesto,
      (SELECT TOP 1 IdDepartamento FROM dbo.Departamentos WHERE Activo = 1 ORDER BY CASE WHEN Nombre = N'Bienestar Estudiantil' THEN 0 ELSE 1 END, IdDepartamento) AS IdDepartamento,
      (SELECT IdRol FROM dbo.Roles WHERE Codigo = 'COMITE_BECAS' AND Activo = 1) AS IdRol,
      (SELECT TOP 1 IdComite FROM dbo.ComitesBeca WHERE Activo = 1 ORDER BY IdComite) AS IdComite
  `);
  let { IdPuesto: idPuesto, IdDepartamento: idDepartamento, IdRol: idRol, IdComite: idComite } = catalogos.recordset[0];
  if (!idRol) throw new Error('No existe el rol activo COMITE_BECAS.');
  if (!idComite) {
    const creado = await transaccion.request().query(`
      INSERT INTO dbo.ComitesBeca (Nombre, Periodo)
      OUTPUT INSERTED.IdComite VALUES (N'Comite de Becas', N'Vigente')
    `);
    idComite = creado.recordset[0].IdComite;
  }

  for (const integrante of integrantes) {
    const cuenta = cuentas.recordset.find((item) => item.Correo.toLowerCase() === integrante.correo);
    await transaccion.request()
      .input('idUsuario', sql.Int, cuenta.IdUsuario)
      .input('idRol', sql.Int, idRol)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.UsuariosRoles WHERE IdUsuario = @idUsuario AND IdRol = @idRol)
          UPDATE dbo.UsuariosRoles SET Activo = 1 WHERE IdUsuario = @idUsuario AND IdRol = @idRol;
        ELSE
          INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol) VALUES (@idUsuario, @idRol);
      `);

    const empleado = await transaccion.request()
      .input('idUsuario', sql.Int, cuenta.IdUsuario)
      .input('numero', sql.NVarChar(30), integrante.numero)
      .input('idPuesto', sql.Int, idPuesto)
      .input('idDepartamento', sql.Int, idDepartamento)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.Empleados WHERE IdUsuario = @idUsuario)
        BEGIN
          UPDATE dbo.Empleados SET Activo = 1,
            IdPuesto = COALESCE(IdPuesto, @idPuesto),
            IdDepartamento = COALESCE(IdDepartamento, @idDepartamento),
            FechaActualizacion = SYSUTCDATETIME()
          WHERE IdUsuario = @idUsuario;
          SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.Empleados (IdUsuario, NumeroEmpleado, IdPuesto, IdDepartamento)
          OUTPUT INSERTED.IdEmpleado VALUES (@idUsuario, @numero, @idPuesto, @idDepartamento);
        END
      `);
    const idEmpleado = empleado.recordset[0].IdEmpleado;

    await transaccion.request()
      .input('idComite', sql.Int, idComite)
      .input('idEmpleado', sql.Int, idEmpleado)
      .input('cargo', sql.NVarChar(100), integrante.cargo)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.MiembrosComite WHERE IdComite = @idComite AND IdEmpleado = @idEmpleado)
          UPDATE dbo.MiembrosComite SET Cargo = @cargo, Activo = 1,
            FechaInicio = DATEADD(DAY, -1, SYSUTCDATETIME()), FechaFin = NULL
          WHERE IdComite = @idComite AND IdEmpleado = @idEmpleado;
        ELSE
          INSERT INTO dbo.MiembrosComite (IdComite, IdEmpleado, Cargo, FechaInicio)
          VALUES (@idComite, @idEmpleado, @cargo, DATEADD(DAY, -1, SYSUTCDATETIME()));
      `);
  }

  await transaccion.commit();
  transaccionActiva = false;
  console.log('Comite de prueba configurado con 3 integrantes vigentes.');
} catch (error) {
  if (transaccionActiva) await transaccion.rollback();
  throw error;
} finally {
  await cerrarPool();
}
