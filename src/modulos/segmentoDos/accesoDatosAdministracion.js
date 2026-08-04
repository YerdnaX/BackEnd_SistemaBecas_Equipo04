import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function listarUsuarios(filtros) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('buscar', sql.NVarChar(150), filtros.buscar ? `%${filtros.buscar}%` : null)
    .input('estado', sql.VarChar(30), filtros.estado || null)
    .input('tipoCuenta', sql.VarChar(20), filtros.tipoCuenta || null)
    .input('limite', sql.Int, filtros.limite)
    .input('desplazamiento', sql.Int, filtros.desplazamiento)
    .query(`
      SELECT u.IdUsuario, u.Correo, u.Nombre, u.PrimerApellido, u.SegundoApellido,
        COALESCE(u.Cedula, identidad.Identificacion) AS Cedula,
        u.Estado, u.CorreoVerificado, u.Activo, u.FechaCreacion,
        CASE WHEN EXISTS (SELECT 1 FROM dbo.Empleados emp WHERE emp.IdUsuario = u.IdUsuario)
          OR EXISTS (
            SELECT 1 FROM dbo.UsuariosRoles urp
            JOIN dbo.Roles rp ON rp.IdRol = urp.IdRol
            WHERE urp.IdUsuario = u.IdUsuario AND urp.Activo = 1
              AND rp.Codigo NOT IN ('ASPIRANTE','BECADO')
          ) THEN 'PERSONAL' ELSE 'ESTUDIANTE' END AS TipoCuenta,
        STRING_AGG(r.Codigo, ',') AS Roles, COUNT(*) OVER() AS Total
      FROM dbo.Usuarios u
      LEFT JOIN dbo.UsuariosRoles ur ON ur.IdUsuario = u.IdUsuario AND ur.Activo = 1
      LEFT JOIN dbo.Roles r ON r.IdRol = ur.IdRol
      OUTER APPLY (
        SELECT TOP 1 dp.Identificacion
        FROM dbo.Solicitudes s
        JOIN dbo.DatosPersonalesSolicitud dp ON dp.IdSolicitud = s.IdSolicitud
        WHERE s.IdUsuario = u.IdUsuario
        ORDER BY s.FechaActualizacion DESC, s.IdSolicitud DESC
      ) identidad
      WHERE (@buscar IS NULL OR u.Correo LIKE @buscar OR u.Nombre LIKE @buscar
             OR u.PrimerApellido LIKE @buscar OR COALESCE(u.Cedula, identidad.Identificacion) LIKE @buscar)
        AND (@estado IS NULL OR u.Estado = @estado)
        AND (
          @tipoCuenta IS NULL
          OR (@tipoCuenta = 'PERSONAL' AND (
            EXISTS (SELECT 1 FROM dbo.Empleados emp WHERE emp.IdUsuario = u.IdUsuario)
            OR EXISTS (
              SELECT 1 FROM dbo.UsuariosRoles urp
              JOIN dbo.Roles rp ON rp.IdRol = urp.IdRol
              WHERE urp.IdUsuario = u.IdUsuario AND urp.Activo = 1
                AND rp.Codigo NOT IN ('ASPIRANTE','BECADO')
            )
          ))
          OR (@tipoCuenta = 'ESTUDIANTE'
            AND NOT EXISTS (SELECT 1 FROM dbo.Empleados emp WHERE emp.IdUsuario = u.IdUsuario)
            AND NOT EXISTS (
              SELECT 1 FROM dbo.UsuariosRoles urp
              JOIN dbo.Roles rp ON rp.IdRol = urp.IdRol
              WHERE urp.IdUsuario = u.IdUsuario AND urp.Activo = 1
                AND rp.Codigo NOT IN ('ASPIRANTE','BECADO')
            ))
        )
      GROUP BY u.IdUsuario, u.Correo, u.Nombre, u.PrimerApellido, u.SegundoApellido, u.Cedula, identidad.Identificacion,
        u.Estado, u.CorreoVerificado, u.Activo, u.FechaCreacion
      ORDER BY u.FechaCreacion DESC
      OFFSET @desplazamiento ROWS FETCH NEXT @limite ROWS ONLY
    `);
  const total = Number(resultado.recordset[0]?.Total || 0);
  const items = resultado.recordset.map(({ Total, ...usuario }) => ({
    ...usuario,
    Roles: usuario.Roles ? usuario.Roles.split(',') : []
  }));
  return { items, total, pagina: filtros.pagina, limite: filtros.limite };
}

export async function obtenerUsuario(idUsuario) {
  const pool = await obtenerPool();
  const usuario = await pool.request().input('id', sql.Int, idUsuario).query(`
    SELECT u.IdUsuario, u.Correo, u.Nombre, u.PrimerApellido, u.SegundoApellido,
      COALESCE(u.Cedula, identidad.Identificacion) AS Cedula, u.Estado,
      u.CorreoVerificado, u.Activo, u.FechaCreacion, u.FechaActualizacion
    FROM dbo.Usuarios u
    OUTER APPLY (
      SELECT TOP 1 dp.Identificacion
      FROM dbo.Solicitudes s
      JOIN dbo.DatosPersonalesSolicitud dp ON dp.IdSolicitud = s.IdSolicitud
      WHERE s.IdUsuario = u.IdUsuario
      ORDER BY s.FechaActualizacion DESC, s.IdSolicitud DESC
    ) identidad
    WHERE u.IdUsuario = @id
  `);
  if (!usuario.recordset[0]) return null;
  const roles = await pool.request().input('id', sql.Int, idUsuario).query(`
    SELECT r.IdRol, r.Codigo, r.Nombre FROM dbo.UsuariosRoles ur
    JOIN dbo.Roles r ON r.IdRol = ur.IdRol WHERE ur.IdUsuario = @id AND ur.Activo = 1
  `);
  return { ...usuario.recordset[0], roles: roles.recordset };
}

export async function obtenerUsuarioPorCedula(cedula) {
  if (!cedula) return null;
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('cedula', sql.Char(9), cedula)
    .query('SELECT IdUsuario FROM dbo.Usuarios WHERE Cedula = @cedula');
  return resultado.recordset[0] || null;
}

export async function crearUsuario(entrada, contrasenaHash) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('correo', sql.NVarChar(150), entrada.correo.toLowerCase())
    .input('hash', sql.NVarChar(255), contrasenaHash)
    .input('nombre', sql.NVarChar(100), entrada.nombre)
    .input('apellido', sql.NVarChar(100), entrada.primerApellido)
    .input('segundo', sql.NVarChar(100), entrada.segundoApellido || null)
    .input('cedula', sql.Char(9), entrada.cedula || null)
    .query(`
      INSERT INTO dbo.Usuarios
        (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Cedula, Estado, CorreoVerificado)
      OUTPUT INSERTED.IdUsuario
      VALUES (@correo, @hash, @nombre, @apellido, @segundo, @cedula, 'ACTIVO', 1)
    `);
  return resultado.recordset[0].IdUsuario;
}

export async function actualizarUsuario(idUsuario, entrada) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idUsuario)
    .input('correo', sql.NVarChar(150), entrada.correo.toLowerCase())
    .input('nombre', sql.NVarChar(100), entrada.nombre)
    .input('apellido', sql.NVarChar(100), entrada.primerApellido)
    .input('segundo', sql.NVarChar(100), entrada.segundoApellido || null)
    .input('cedula', sql.Char(9), entrada.cedula || null)
    .query(`
      UPDATE dbo.Usuarios SET Correo = @correo, Nombre = @nombre, PrimerApellido = @apellido,
        SegundoApellido = @segundo, Cedula = COALESCE(@cedula, Cedula), FechaActualizacion = SYSUTCDATETIME()
      WHERE IdUsuario = @id
    `);
}

export async function cambiarEstadoUsuario(idUsuario, estado) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idUsuario)
      .input('estado', sql.VarChar(30), estado).query(`
        UPDATE dbo.Usuarios SET Estado = @estado,
          Activo = CASE WHEN @estado = 'INACTIVO' THEN 0 ELSE 1 END,
          FechaActualizacion = SYSUTCDATETIME() WHERE IdUsuario = @id
      `);
    if (['BLOQUEADO', 'INACTIVO'].includes(estado)) {
      await transaccion.request().input('id', sql.Int, idUsuario).query(`
        UPDATE dbo.Sesiones SET Activa = 0, FechaRevocacion = SYSUTCDATETIME()
        WHERE IdUsuario = @id AND Activa = 1
      `);
    }
    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function asignarRoles(idUsuario, idsRoles) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idUsuario)
      .query('UPDATE dbo.UsuariosRoles SET Activo = 0 WHERE IdUsuario = @id');
    for (const idRol of idsRoles) {
      await transaccion.request().input('idUsuario', sql.Int, idUsuario)
        .input('idRol', sql.Int, idRol).query(`
          IF EXISTS (SELECT 1 FROM dbo.UsuariosRoles WHERE IdUsuario = @idUsuario AND IdRol = @idRol)
            UPDATE dbo.UsuariosRoles SET Activo = 1 WHERE IdUsuario = @idUsuario AND IdRol = @idRol;
          ELSE
            INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol) VALUES (@idUsuario, @idRol);
        `);
    }
    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function listarRoles() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT r.*, COUNT(rp.IdPermiso) AS CantidadPermisos,
      STRING_AGG(CONVERT(NVARCHAR(12), rp.IdPermiso), ',') AS IdsPermisos
    FROM dbo.Roles r LEFT JOIN dbo.RolesPermisos rp ON rp.IdRol = r.IdRol
    GROUP BY r.IdRol, r.Codigo, r.Nombre, r.Descripcion, r.Activo ORDER BY r.Nombre
  `);
  return resultado.recordset.map((rol) => ({
    ...rol,
    IdsPermisos: rol.IdsPermisos ? rol.IdsPermisos.split(',').map(Number) : []
  }));
}

export async function crearRol(entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('codigo', sql.NVarChar(40), entrada.codigo)
    .input('nombre', sql.NVarChar(100), entrada.nombre)
    .input('descripcion', sql.NVarChar(300), entrada.descripcion || null).query(`
      INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion)
      OUTPUT INSERTED.IdRol VALUES (@codigo, @nombre, @descripcion)
    `);
  return resultado.recordset[0].IdRol;
}

export async function actualizarRol(idRol, entrada) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idRol)
    .input('nombre', sql.NVarChar(100), entrada.nombre)
    .input('descripcion', sql.NVarChar(300), entrada.descripcion || null)
    .input('activo', sql.Bit, entrada.activo !== false).query(`
      UPDATE dbo.Roles SET Nombre = @nombre, Descripcion = @descripcion, Activo = @activo WHERE IdRol = @id
    `);
}

export async function listarPermisos() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query('SELECT * FROM dbo.Permisos WHERE Activo = 1 ORDER BY Codigo');
  return resultado.recordset;
}

export async function asignarPermisosRol(idRol, idsPermisos) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    await transaccion.request().input('id', sql.Int, idRol)
      .query('DELETE FROM dbo.RolesPermisos WHERE IdRol = @id');
    for (const idPermiso of idsPermisos) {
      await transaccion.request().input('idRol', sql.Int, idRol)
        .input('idPermiso', sql.Int, idPermiso)
        .query('INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso) VALUES (@idRol, @idPermiso)');
    }
    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function listarEmpleados() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT e.*, u.Correo, u.Nombre, u.PrimerApellido, p.Nombre AS Puesto,
      d.Nombre AS Departamento
    FROM dbo.Empleados e JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
    LEFT JOIN dbo.Puestos p ON p.IdPuesto = e.IdPuesto
    LEFT JOIN dbo.Departamentos d ON d.IdDepartamento = e.IdDepartamento
    ORDER BY u.PrimerApellido, u.Nombre
  `);
  return resultado.recordset;
}

export async function obtenerEmpleado(idEmpleado) {
  const empleados = await listarEmpleados();
  return empleados.find((empleado) => empleado.IdEmpleado === idEmpleado) || null;
}

export async function crearEmpleado(entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idUsuario', sql.Int, entrada.idUsuario)
    .input('numero', sql.NVarChar(30), entrada.numeroEmpleado)
    .input('idPuesto', sql.Int, entrada.idPuesto || null)
    .input('idDepartamento', sql.Int, entrada.idDepartamento || null).query(`
      INSERT INTO dbo.Empleados (IdUsuario, NumeroEmpleado, IdPuesto, IdDepartamento)
      OUTPUT INSERTED.IdEmpleado VALUES (@idUsuario, @numero, @idPuesto, @idDepartamento)
    `);
  return resultado.recordset[0].IdEmpleado;
}

export async function actualizarEmpleado(idEmpleado, entrada) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idEmpleado)
    .input('numero', sql.NVarChar(30), entrada.numeroEmpleado)
    .input('idPuesto', sql.Int, entrada.idPuesto || null)
    .input('idDepartamento', sql.Int, entrada.idDepartamento || null).query(`
      UPDATE dbo.Empleados SET NumeroEmpleado = @numero, IdPuesto = @idPuesto,
        IdDepartamento = @idDepartamento, FechaActualizacion = SYSUTCDATETIME()
      WHERE IdEmpleado = @id
    `);
}

export async function cambiarEstadoEmpleado(idEmpleado, activo) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idEmpleado).input('activo', sql.Bit, activo)
    .query('UPDATE dbo.Empleados SET Activo = @activo, FechaActualizacion = SYSUTCDATETIME() WHERE IdEmpleado = @id');
}

export async function listarCatalogosPersonal() {
  const pool = await obtenerPool();
  const [puestos, departamentos, comites] = await Promise.all([
    pool.request().query(`
      SELECT * FROM dbo.Puestos p
      WHERE p.Activo = 1
         OR EXISTS (SELECT 1 FROM dbo.Empleados e WHERE e.IdPuesto = p.IdPuesto)
      ORDER BY p.Activo DESC, p.Nombre
    `),
    pool.request().query(`
      SELECT * FROM dbo.Departamentos d
      WHERE d.Activo = 1
         OR EXISTS (SELECT 1 FROM dbo.Empleados e WHERE e.IdDepartamento = d.IdDepartamento)
      ORDER BY d.Activo DESC, d.Nombre
    `),
    pool.request().query('SELECT * FROM dbo.ComitesBeca WHERE Activo = 1 ORDER BY Nombre')
  ]);
  return { puestos: puestos.recordset, departamentos: departamentos.recordset, comites: comites.recordset };
}

export async function listarMiembrosComite() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT m.*, c.Nombre AS Comite, e.NumeroEmpleado,
      CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Empleado
    FROM dbo.MiembrosComite m
    JOIN dbo.ComitesBeca c ON c.IdComite = m.IdComite
    JOIN dbo.Empleados e ON e.IdEmpleado = m.IdEmpleado
    JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
    ORDER BY m.Activo DESC, m.FechaInicio DESC
  `);
  return resultado.recordset;
}

export async function crearMiembroComite(entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idComite', sql.Int, entrada.idComite)
    .input('idEmpleado', sql.Int, entrada.idEmpleado)
    .input('cargo', sql.NVarChar(100), entrada.cargo)
    .input('inicio', sql.DateTime2, entrada.fechaInicio || new Date())
    .input('fin', sql.DateTime2, entrada.fechaFin || null).query(`
      INSERT INTO dbo.MiembrosComite (IdComite, IdEmpleado, Cargo, FechaInicio, FechaFin)
      OUTPUT INSERTED.IdMiembroComite VALUES (@idComite, @idEmpleado, @cargo, @inicio, @fin)
    `);
  return resultado.recordset[0].IdMiembroComite;
}

export async function asegurarRolComite(idUsuario) {
  const pool = await obtenerPool();
  await pool.request().input('idUsuario', sql.Int, idUsuario).query(`
    DECLARE @idRol INT = (SELECT IdRol FROM dbo.Roles WHERE Codigo = 'COMITE_BECAS');
    IF @idRol IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.UsuariosRoles WHERE IdUsuario = @idUsuario AND IdRol = @idRol)
        UPDATE dbo.UsuariosRoles SET Activo = 1 WHERE IdUsuario = @idUsuario AND IdRol = @idRol;
      ELSE
        INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol) VALUES (@idUsuario, @idRol);
    END
  `);
}

export async function desactivarMiembroComite(idMiembro) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idMiembro).query(`
    UPDATE dbo.MiembrosComite SET Activo = 0, FechaFin = COALESCE(FechaFin, SYSUTCDATETIME())
    WHERE IdMiembroComite = @id
  `);
}

export async function obtenerIndicadores(filtros) {
  const pool = await obtenerPool();
  const request = pool.request()
    .input('periodo', sql.NVarChar(30), filtros.periodo || null)
    .input('estado', sql.VarChar(30), filtros.estado || null)
    .input('idTipo', sql.Int, filtros.idTipoBeca ? Number(filtros.idTipoBeca) : null)
    .input('facultad', sql.NVarChar(150), filtros.facultad ? `%${filtros.facultad}%` : null);
  const resultado = await request.query(`
    SELECT
      COUNT(DISTINCT s.IdSolicitud) AS TotalSolicitudes,
      SUM(CASE WHEN s.Estado IN ('APROBADA','CONDICIONADA') THEN 1 ELSE 0 END) AS SolicitudesAprobadas,
      COUNT(DISTINCT CASE WHEN b.Estado = 'ACTIVA' THEN b.IdBecaActiva END) AS BecasActivas,
      CAST(100.0 * SUM(CASE WHEN s.Estado IN ('APROBADA','CONDICIONADA') THEN 1 ELSE 0 END)
        / NULLIF(COUNT(DISTINCT s.IdSolicitud), 0) AS DECIMAL(5,2)) AS PorcentajeAprobacion
    FROM dbo.Solicitudes s
    JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
    LEFT JOIN dbo.Expedientes e ON e.IdSolicitud = s.IdSolicitud
    LEFT JOIN dbo.BecasActivas b ON b.IdExpediente = e.IdExpediente
    LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
    WHERE (@periodo IS NULL OR b.Periodo = @periodo)
      AND (@estado IS NULL OR b.Estado = @estado)
      AND (@idTipo IS NULL OR c.IdTipoBeca = @idTipo)
      AND (@facultad IS NULL OR da.Carrera LIKE @facultad)
  `);
  return resultado.recordset[0];
}

export async function listarBecasReporte(filtros) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('periodo', sql.NVarChar(30), filtros.periodo || null)
    .input('facultad', sql.NVarChar(150), filtros.facultad || null)
    .input('estado', sql.VarChar(30), filtros.estado || null)
    .input('idTipo', sql.Int, filtros.idTipoBeca ? Number(filtros.idTipoBeca) : null)
    .query(`
    SELECT b.IdBecaActiva, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Estudiante,
      da.NumeroEstudiante, da.Carrera, tb.Nombre AS TipoBeca, b.Porcentaje, b.Periodo, b.Estado
    FROM dbo.BecasActivas b
    JOIN dbo.Expedientes e ON e.IdExpediente = b.IdExpediente
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    JOIN dbo.TiposBeca tb ON tb.IdTipoBeca = b.IdTipoBeca
    LEFT JOIN dbo.DatosAcademicosSolicitud da ON da.IdSolicitud = s.IdSolicitud
    WHERE (@periodo IS NULL OR b.Periodo = @periodo)
      AND (@facultad IS NULL OR da.Carrera = @facultad)
      AND (@estado IS NULL OR b.Estado = @estado)
      AND (@idTipo IS NULL OR b.IdTipoBeca = @idTipo)
    ORDER BY b.FechaActivacion DESC
  `);
  return resultado.recordset;
}

export async function listarFiltrosReporte() {
  const pool = await obtenerPool();
  const [periodos, carreras, tiposBeca, estados] = await Promise.all([
    pool.request().query(`
      SELECT DISTINCT Periodo
      FROM dbo.BecasActivas
      WHERE Periodo IS NOT NULL AND LTRIM(RTRIM(Periodo)) <> ''
      ORDER BY Periodo DESC
    `),
    pool.request().query(`
      SELECT DISTINCT Carrera
      FROM dbo.DatosAcademicosSolicitud
      WHERE Carrera IS NOT NULL AND LTRIM(RTRIM(Carrera)) <> ''
      ORDER BY Carrera
    `),
    pool.request().query(`
      SELECT IdTipoBeca, Nombre FROM dbo.TiposBeca WHERE Activo = 1 ORDER BY Nombre
    `),
    pool.request().query(`
      SELECT DISTINCT Estado FROM dbo.BecasActivas
      WHERE Estado IS NOT NULL ORDER BY Estado
    `)
  ]);
  return {
    periodos: periodos.recordset.map((fila) => fila.Periodo),
    carreras: carreras.recordset.map((fila) => fila.Carrera),
    tiposBeca: tiposBeca.recordset,
    estados: estados.recordset.map((fila) => fila.Estado)
  };
}

export async function obtenerResumenRenovaciones(filtros = {}) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('periodo', sql.NVarChar(30), filtros.periodo || null)
    .query(`
    SELECT Periodo, COALESCE(ResultadoDetalle, EstadoProceso) AS Estado, COUNT(*) AS Total
    FROM dbo.RenovacionesBeca
    WHERE (@periodo IS NULL OR Periodo = @periodo)
    GROUP BY Periodo, COALESCE(ResultadoDetalle, EstadoProceso)
    ORDER BY Periodo DESC
  `);
  return resultado.recordset;
}

export async function listarActas() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT a.*, s.Nombre AS Sesion, s.FechaSesion, s.Estado
    FROM dbo.ActasComite a JOIN dbo.SesionesComite s ON s.IdSesionComite = a.IdSesionComite
    ORDER BY a.FechaGeneracion DESC
  `);
  return resultado.recordset;
}

export async function sincronizarActasSesionesCerradas() {
  const pool = await obtenerPool();
  await pool.request().query(`
    INSERT INTO dbo.ActasComite (IdSesionComite, NumeroActa, Contenido)
    SELECT s.IdSesionComite, CONCAT('ACTA-', s.IdSesionComite),
      CONCAT(
        N'Sesion: ', s.Nombre, CHAR(10),
        N'Estado: CERRADA', CHAR(10),
        N'Resultados publicados: ', COUNT(cs.IdCasoSesion), CHAR(10),
        N'Las resoluciones individuales fueron publicadas en los expedientes.'
      )
    FROM dbo.SesionesComite s
    LEFT JOIN dbo.CasosSesionComite cs ON cs.IdSesionComite = s.IdSesionComite
    WHERE s.Estado = 'CERRADA'
      AND NOT EXISTS (
        SELECT 1 FROM dbo.ActasComite a WHERE a.IdSesionComite = s.IdSesionComite
      )
    GROUP BY s.IdSesionComite, s.Nombre
  `);
}

export async function obtenerActa(idActa) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idActa).query(`
    SELECT a.*, s.Nombre AS Sesion, s.FechaSesion, s.Estado
    FROM dbo.ActasComite a JOIN dbo.SesionesComite s ON s.IdSesionComite = a.IdSesionComite
    WHERE a.IdActa = @id
  `);
  return resultado.recordset[0] || null;
}

export async function asociarArchivoActa(idActa, idArchivo) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idActa).input('idArchivo', sql.Int, idArchivo)
    .query('UPDATE dbo.ActasComite SET IdArchivo = @idArchivo, FechaGeneracion = SYSUTCDATETIME() WHERE IdActa = @id');
}

export async function registrarAuditoria(idUsuario, modulo, accion, entidad, idEntidad, detalle) {
  const pool = await obtenerPool();
  await pool.request().input('idUsuario', sql.Int, idUsuario)
    .input('modulo', sql.NVarChar(60), modulo)
    .input('accion', sql.NVarChar(60), accion)
    .input('entidad', sql.NVarChar(60), entidad)
    .input('idEntidad', sql.Int, idEntidad || null)
    .input('detalle', sql.NVarChar(1000), detalle || null).query(`
      INSERT INTO dbo.AuditoriaAcciones (IdUsuario, Modulo, Accion, Entidad, IdEntidad, Detalle)
      VALUES (@idUsuario, @modulo, @accion, @entidad, @idEntidad, @detalle)
    `);
}
