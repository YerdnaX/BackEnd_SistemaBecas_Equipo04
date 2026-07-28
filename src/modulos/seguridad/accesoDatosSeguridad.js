import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function listarAuditoria({ modulo, idUsuario, pagina = 1, tamanoPagina = 30 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (modulo) { solicitud.input('modulo', sql.NVarChar(60), modulo); condiciones.push('a.Modulo = @modulo'); }
  if (idUsuario) { solicitud.input('idUsuario', sql.Int, idUsuario); condiciones.push('a.IdUsuario = @idUsuario'); }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT a.*, u.Correo AS CorreoUsuario, COUNT(*) OVER() AS TotalRegistros
    FROM dbo.AuditoriaAcciones a
    LEFT JOIN dbo.Usuarios u ON u.IdUsuario = a.IdUsuario
    ${filtro}
    ORDER BY a.Fecha DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function listarEventosSeguridad({ nivel, pagina = 1, tamanoPagina = 30 } = {}) {
  const pool = await obtenerPool();
  const desplazamiento = (pagina - 1) * tamanoPagina;
  const solicitud = pool.request()
    .input('desplazamiento', sql.Int, desplazamiento)
    .input('tamanoPagina', sql.Int, tamanoPagina);

  const condiciones = [];
  if (nivel) { solicitud.input('nivel', sql.VarChar(20), nivel); condiciones.push('ev.Nivel = @nivel'); }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const resultado = await solicitud.query(`
    SELECT ev.*, u.Correo AS CorreoUsuario, COUNT(*) OVER() AS TotalRegistros
    FROM dbo.EventosSeguridad ev
    LEFT JOIN dbo.Usuarios u ON u.IdUsuario = ev.IdUsuario
    ${filtro}
    ORDER BY ev.Fecha DESC
    OFFSET @desplazamiento ROWS FETCH NEXT @tamanoPagina ROWS ONLY
  `);
  return resultado.recordset;
}

export async function obtenerEventoSeguridadPorId(idEvento) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idEvento)
    .query('SELECT * FROM dbo.EventosSeguridad WHERE IdEventoSeguridad = @id');
  return resultado.recordset[0] || null;
}

export async function marcarEventoSeguridadRevisado(idEvento) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idEvento)
    .query('UPDATE dbo.EventosSeguridad SET Revisado = 1 WHERE IdEventoSeguridad = @id');
}

export async function listarSesionesPropias(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT IdSesion, DireccionIp, AgenteUsuario, FechaCreacion, FechaVencimiento, Activa
      FROM dbo.Sesiones
      WHERE IdUsuario = @idUsuario AND Activa = 1 AND FechaVencimiento > SYSUTCDATETIME()
      ORDER BY FechaCreacion DESC
    `);
  return resultado.recordset;
}

export async function listarSesionesActivas() {
  const pool = await obtenerPool();
  const resultado = await pool.request().query(`
    SELECT s.IdSesion, s.IdUsuario, u.Correo, u.Nombre, s.DireccionIp, s.AgenteUsuario, s.FechaCreacion, s.FechaVencimiento
    FROM dbo.Sesiones s
    JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    WHERE s.Activa = 1 AND s.FechaVencimiento > SYSUTCDATETIME()
    ORDER BY s.FechaCreacion DESC
  `);
  return resultado.recordset;
}

export async function obtenerSesionPorId(idSesion) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idSesion)
    .query('SELECT * FROM dbo.Sesiones WHERE IdSesion = @id');
  return resultado.recordset[0] || null;
}

export async function revocarSesionPorId(idSesion) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idSesion)
    .query(`UPDATE dbo.Sesiones SET Activa = 0, FechaRevocacion = SYSUTCDATETIME() WHERE IdSesion = @id`);
}
