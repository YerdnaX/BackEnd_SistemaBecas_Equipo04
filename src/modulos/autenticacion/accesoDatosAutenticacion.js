import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerUsuarioPorCorreo(correo) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('correo', sql.NVarChar(150), correo.toLowerCase())
    .query('SELECT * FROM dbo.Usuarios WHERE Correo = @correo');
  return resultado.recordset[0] || null;
}

export async function obtenerUsuarioPorId(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query('SELECT * FROM dbo.Usuarios WHERE IdUsuario = @idUsuario');
  return resultado.recordset[0] || null;
}

export async function crearUsuario({ correo, contrasenaHash, nombre, primerApellido, segundoApellido }) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('correo', sql.NVarChar(150), correo.toLowerCase())
      .input('contrasenaHash', sql.NVarChar(255), contrasenaHash)
      .input('nombre', sql.NVarChar(100), nombre)
      .input('primerApellido', sql.NVarChar(100), primerApellido)
      .input('segundoApellido', sql.NVarChar(100), segundoApellido || null)
      .query(`
        INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido)
        OUTPUT INSERTED.IdUsuario
        VALUES (@correo, @contrasenaHash, @nombre, @primerApellido, @segundoApellido)
      `);
    const idUsuario = resultado.recordset[0].IdUsuario;

    await transaccion.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol)
        SELECT @idUsuario, IdRol FROM dbo.Roles WHERE Codigo = 'ASPIRANTE'
      `);

    await transaccion.commit();
    return idUsuario;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerRolesYPermisos(idUsuario) {
  const pool = await obtenerPool();
  const roles = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT r.Codigo FROM dbo.UsuariosRoles ur
      JOIN dbo.Roles r ON r.IdRol = ur.IdRol
      WHERE ur.IdUsuario = @idUsuario AND ur.Activo = 1 AND r.Activo = 1
    `);

  const permisos = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT DISTINCT p.Codigo FROM dbo.UsuariosRoles ur
      JOIN dbo.RolesPermisos rp ON rp.IdRol = ur.IdRol
      JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
      WHERE ur.IdUsuario = @idUsuario AND ur.Activo = 1 AND p.Activo = 1
    `);

  return {
    roles: roles.recordset.map((fila) => fila.Codigo),
    permisos: permisos.recordset.map((fila) => fila.Codigo)
  };
}

export async function incrementarIntentosFallidos(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.Usuarios SET IntentosFallidos = IntentosFallidos + 1,
        Estado = CASE WHEN IntentosFallidos + 1 >= 5 THEN 'BLOQUEADO' ELSE Estado END
      WHERE IdUsuario = @idUsuario
    `);
}

export async function resetearIntentosFallidos(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query('UPDATE dbo.Usuarios SET IntentosFallidos = 0 WHERE IdUsuario = @idUsuario');
}

export async function actualizarContrasena(idUsuario, contrasenaHash) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('contrasenaHash', sql.NVarChar(255), contrasenaHash)
    .query(`
      UPDATE dbo.Usuarios SET ContrasenaHash = @contrasenaHash, IntentosFallidos = 0,
        FechaActualizacion = SYSUTCDATETIME() WHERE IdUsuario = @idUsuario
    `);
}

export async function activarUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.Usuarios SET Estado = 'ACTIVO', CorreoVerificado = 1,
        FechaActualizacion = SYSUTCDATETIME() WHERE IdUsuario = @idUsuario
    `);
}

export async function actualizarCorreoUsuario(idUsuario, correo) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('correo', sql.NVarChar(150), correo.toLowerCase())
    .query(`
      UPDATE dbo.Usuarios
      SET Correo = @correo, CorreoVerificado = 1, FechaActualizacion = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario
    `);
}

// --- Tokens de activacion ---

export async function invalidarTokensActivacionUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.TokensActivacion
      SET FechaUso = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario AND FechaUso IS NULL
    `);
}

export async function crearTokenActivacion(idUsuario, tokenHash, fechaVencimiento) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .input('fechaVencimiento', sql.DateTime2, fechaVencimiento)
    .query(`
      INSERT INTO dbo.TokensActivacion (IdUsuario, TokenHash, FechaVencimiento)
      VALUES (@idUsuario, @tokenHash, @fechaVencimiento)
    `);
}

export async function obtenerTokenActivacionVigente(tokenHash, idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1 * FROM dbo.TokensActivacion
      WHERE TokenHash = @tokenHash
        AND IdUsuario = @idUsuario
        AND FechaUso IS NULL
        AND FechaVencimiento > SYSUTCDATETIME()
      ORDER BY IdTokenActivacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function marcarTokenActivacionUsado(idTokenActivacion) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idTokenActivacion)
    .query('UPDATE dbo.TokensActivacion SET FechaUso = SYSUTCDATETIME() WHERE IdTokenActivacion = @id');
}

// --- Retos de doble factor ---

export async function invalidarRetosDosFactoresUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.RetosDosFactores
      SET FechaUso = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario AND FechaUso IS NULL
    `);
}

export async function crearRetoDosFactores({ idUsuario, codigoHash, fechaVencimiento }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('codigoHash', sql.NVarChar(255), codigoHash)
    .input('fechaVencimiento', sql.DateTime2, fechaVencimiento)
    .query(`
      INSERT INTO dbo.RetosDosFactores (IdUsuario, CodigoHash, FechaVencimiento)
      OUTPUT INSERTED.IdReto
      VALUES (@idUsuario, @codigoHash, @fechaVencimiento)
    `);
  return resultado.recordset[0].IdReto;
}

export async function obtenerRetoDosFactoresVigente(idReto) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idReto', sql.Int, idReto)
    .query(`
      SELECT TOP 1 * FROM dbo.RetosDosFactores
      WHERE IdReto = @idReto
        AND FechaUso IS NULL
        AND FechaVencimiento > SYSUTCDATETIME()
    `);
  return resultado.recordset[0] || null;
}

export async function incrementarIntentosRetoDosFactores(idReto) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idReto', sql.Int, idReto)
    .query('UPDATE dbo.RetosDosFactores SET Intentos = Intentos + 1 WHERE IdReto = @idReto');
}

export async function marcarRetoDosFactoresUsado(idReto) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idReto', sql.Int, idReto)
    .query('UPDATE dbo.RetosDosFactores SET FechaUso = SYSUTCDATETIME() WHERE IdReto = @idReto');
}

// --- Tokens de recuperacion ---

export async function crearTokenRecuperacion(idUsuario, tokenHash, fechaVencimiento) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .input('fechaVencimiento', sql.DateTime2, fechaVencimiento)
    .query(`
      INSERT INTO dbo.TokensRecuperacion (IdUsuario, TokenHash, FechaVencimiento)
      VALUES (@idUsuario, @tokenHash, @fechaVencimiento)
    `);
}

export async function invalidarTokensRecuperacionUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.TokensRecuperacion
      SET FechaUso = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario AND FechaUso IS NULL
    `);
}

export async function obtenerTokenRecuperacionVigente(tokenHash) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .query(`
      SELECT TOP 1 * FROM dbo.TokensRecuperacion
      WHERE TokenHash = @tokenHash AND FechaUso IS NULL AND FechaVencimiento > SYSUTCDATETIME()
      ORDER BY IdTokenRecuperacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerTokenRecuperacionVigentePorUsuario(tokenHash, idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1 * FROM dbo.TokensRecuperacion
      WHERE IdUsuario = @idUsuario
        AND TokenHash = @tokenHash
        AND FechaUso IS NULL
        AND FechaVencimiento > SYSUTCDATETIME()
      ORDER BY IdTokenRecuperacion DESC
    `);
  return resultado.recordset[0] || null;
}

export async function marcarTokenRecuperacionUsado(idTokenRecuperacion) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idTokenRecuperacion)
    .query('UPDATE dbo.TokensRecuperacion SET FechaUso = SYSUTCDATETIME() WHERE IdTokenRecuperacion = @id');
}

// --- Tokens de cambio de correo ---

export async function invalidarTokensCambioCorreoUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.TokensCambioCorreo
      SET FechaUso = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario AND FechaUso IS NULL
    `);
}

export async function crearTokenCambioCorreo(idUsuario, correoNuevo, tokenHash, fechaVencimiento) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('correoNuevo', sql.NVarChar(150), correoNuevo.toLowerCase())
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .input('fechaVencimiento', sql.DateTime2, fechaVencimiento)
    .query(`
      INSERT INTO dbo.TokensCambioCorreo (IdUsuario, CorreoNuevo, TokenHash, FechaVencimiento)
      VALUES (@idUsuario, @correoNuevo, @tokenHash, @fechaVencimiento)
    `);
}

export async function obtenerTokenCambioCorreoVigentePorUsuario(idUsuario, correoNuevo, tokenHash) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('correoNuevo', sql.NVarChar(150), correoNuevo.toLowerCase())
    .input('tokenHash', sql.NVarChar(255), tokenHash)
    .query(`
      SELECT TOP 1 * FROM dbo.TokensCambioCorreo
      WHERE IdUsuario = @idUsuario
        AND CorreoNuevo = @correoNuevo
        AND TokenHash = @tokenHash
        AND FechaUso IS NULL
        AND FechaVencimiento > SYSUTCDATETIME()
      ORDER BY IdTokenCambioCorreo DESC
    `);
  return resultado.recordset[0] || null;
}

export async function marcarTokenCambioCorreoUsado(idTokenCambioCorreo) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idTokenCambioCorreo)
    .query('UPDATE dbo.TokensCambioCorreo SET FechaUso = SYSUTCDATETIME() WHERE IdTokenCambioCorreo = @id');
}

// --- Sesiones (refresh token) ---

export async function crearSesion({ idUsuario, refreshTokenHash, fechaVencimiento, direccionIp, agenteUsuario }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('refreshTokenHash', sql.NVarChar(255), refreshTokenHash)
    .input('fechaVencimiento', sql.DateTime2, fechaVencimiento)
    .input('direccionIp', sql.VarChar(64), direccionIp || null)
    .input('agenteUsuario', sql.NVarChar(255), agenteUsuario || null)
    .query(`
      INSERT INTO dbo.Sesiones (IdUsuario, RefreshTokenHash, FechaVencimiento, DireccionIp, AgenteUsuario)
      OUTPUT INSERTED.IdSesion
      VALUES (@idUsuario, @refreshTokenHash, @fechaVencimiento, @direccionIp, @agenteUsuario)
    `);
  return resultado.recordset[0].IdSesion;
}

export async function obtenerSesionPorRefreshHash(refreshTokenHash) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('refreshTokenHash', sql.NVarChar(255), refreshTokenHash)
    .query(`
      SELECT TOP 1 * FROM dbo.Sesiones
      WHERE RefreshTokenHash = @refreshTokenHash AND Activa = 1 AND FechaVencimiento > SYSUTCDATETIME()
    `);
  return resultado.recordset[0] || null;
}

export async function revocarSesion(idSesion) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idSesion)
    .query('UPDATE dbo.Sesiones SET Activa = 0, FechaRevocacion = SYSUTCDATETIME() WHERE IdSesion = @id');
}

export async function revocarSesionesUsuario(idUsuario) {
  const pool = await obtenerPool();
  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      UPDATE dbo.Sesiones SET Activa = 0, FechaRevocacion = SYSUTCDATETIME()
      WHERE IdUsuario = @idUsuario AND Activa = 1
    `);
}
