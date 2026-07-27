import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerPropietarioExpediente(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idExpediente).query(`
    SELECT s.IdUsuario, dp.Direccion
    FROM dbo.Expedientes e
    JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
    LEFT JOIN dbo.DatosPersonalesSolicitud dp ON dp.IdSolicitud = s.IdSolicitud
    WHERE e.IdExpediente = @id
  `);
  return resultado.recordset[0] || null;
}

export async function listarVisitas(idExpediente) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idExpediente).query(`
    SELECT v.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Responsable,
      i.IdInformeVisita, i.Resultado, i.Observaciones AS ObservacionesInforme, i.FechaRegistro
    FROM dbo.VisitasDomiciliarias v
    LEFT JOIN dbo.Empleados em ON em.IdEmpleado = v.IdResponsable
    LEFT JOIN dbo.Usuarios u ON u.IdUsuario = em.IdUsuario
    LEFT JOIN dbo.InformesVisita i ON i.IdVisita = v.IdVisita
    WHERE v.IdExpediente = @id ORDER BY v.FechaProgramada DESC
  `);
  return resultado.recordset;
}

export async function existeTraslapeVisita(idUsuarioResponsable, fechaProgramada, idVisitaExcluir = null) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuarioResponsable)
    .input('fecha', sql.DateTime2, fechaProgramada)
    .input('idExcluir', sql.Int, idVisitaExcluir)
    .query(`
      SELECT TOP 1 v.IdVisita
      FROM dbo.VisitasDomiciliarias v
      JOIN dbo.Empleados e ON e.IdEmpleado = v.IdResponsable
      WHERE e.IdUsuario = @idUsuario AND v.Estado = 'PROGRAMADA'
        AND (@idExcluir IS NULL OR v.IdVisita <> @idExcluir)
        AND ABS(DATEDIFF(MINUTE, v.FechaProgramada, @fecha)) < 120
    `);
  return Boolean(resultado.recordset[0]);
}

export async function crearVisita(idExpediente, idUsuarioResponsable, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idExpediente', sql.Int, idExpediente)
    .input('idUsuario', sql.Int, idUsuarioResponsable)
    .input('fecha', sql.DateTime2, entrada.fechaProgramada)
    .input('direccion', sql.NVarChar(300), entrada.direccion)
    .input('observaciones', sql.NVarChar(600), entrada.observaciones || null)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      INSERT INTO dbo.VisitasDomiciliarias
        (IdExpediente, IdResponsable, FechaProgramada, Direccion, Observaciones)
      OUTPUT INSERTED.IdVisita
      VALUES (@idExpediente, @IdEmpleado, @fecha, @direccion, @observaciones)
    `);
  return resultado.recordset[0]?.IdVisita || null;
}

export async function obtenerVisita(idVisita) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('id', sql.Int, idVisita)
    .query('SELECT * FROM dbo.VisitasDomiciliarias WHERE IdVisita = @id');
  return resultado.recordset[0] || null;
}

export async function actualizarVisita(idVisita, idUsuarioResponsable, entrada) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idVisita)
    .input('idUsuario', sql.Int, idUsuarioResponsable)
    .input('fecha', sql.DateTime2, entrada.fechaProgramada)
    .input('direccion', sql.NVarChar(300), entrada.direccion)
    .input('observaciones', sql.NVarChar(600), entrada.observaciones || null)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      UPDATE dbo.VisitasDomiciliarias
      SET IdResponsable = COALESCE(@IdEmpleado, IdResponsable), FechaProgramada = @fecha,
        Direccion = @direccion, Observaciones = @observaciones
      WHERE IdVisita = @id AND Estado = 'PROGRAMADA'
    `);
}

export async function cancelarVisita(idVisita, observacion) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idVisita)
    .input('observacion', sql.NVarChar(600), observacion || null)
    .query(`
      UPDATE dbo.VisitasDomiciliarias SET Estado = 'CANCELADA',
        Observaciones = COALESCE(@observacion, Observaciones)
      WHERE IdVisita = @id AND Estado = 'PROGRAMADA'
    `);
}

export async function registrarInformeVisita(idVisita, entrada) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const resultado = await transaccion.request()
      .input('idVisita', sql.Int, idVisita)
      .input('resultado', sql.NVarChar(60), entrada.resultado)
      .input('observaciones', sql.NVarChar(600), entrada.observaciones || null)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.InformesVisita WHERE IdVisita = @idVisita)
          UPDATE dbo.InformesVisita SET Resultado = @resultado, Observaciones = @observaciones,
            FechaRegistro = SYSUTCDATETIME() WHERE IdVisita = @idVisita;
        ELSE
          INSERT INTO dbo.InformesVisita (IdVisita, Resultado, Observaciones)
          VALUES (@idVisita, @resultado, @observaciones);
        UPDATE dbo.VisitasDomiciliarias
        SET Estado = 'REALIZADA', FechaRealizada = SYSUTCDATETIME()
        WHERE IdVisita = @idVisita AND Estado <> 'CANCELADA';
        SELECT v.IdExpediente FROM dbo.VisitasDomiciliarias v WHERE v.IdVisita = @idVisita;
      `);
    await transaccion.commit();
    return resultado.recordset[0] || null;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function listarConsultasPropias(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request().input('idUsuario', sql.Int, idUsuario).query(`
    SELECT c.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Responsable
    FROM dbo.ConsultasUsuarios c
    LEFT JOIN dbo.Empleados e ON e.IdEmpleado = c.IdResponsable
    LEFT JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario
    WHERE c.IdUsuario = @idUsuario ORDER BY c.FechaCreacion DESC
  `);
  return resultado.recordset;
}

export async function crearConsulta(idUsuario, entrada) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const consulta = await transaccion.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('asunto', sql.NVarChar(150), entrada.asunto)
      .query(`
        INSERT INTO dbo.ConsultasUsuarios (IdUsuario, Asunto)
        OUTPUT INSERTED.IdConsulta VALUES (@idUsuario, @asunto)
      `);
    const idConsulta = consulta.recordset[0].IdConsulta;
    await transaccion.request()
      .input('idConsulta', sql.Int, idConsulta)
      .input('idUsuario', sql.Int, idUsuario)
      .input('mensaje', sql.NVarChar(1000), entrada.mensaje)
      .query(`
        INSERT INTO dbo.RespuestasConsulta (IdConsulta, IdUsuario, Mensaje)
        VALUES (@idConsulta, @idUsuario, @mensaje)
      `);
    await transaccion.commit();
    return idConsulta;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function obtenerConsulta(idConsulta) {
  const pool = await obtenerPool();
  const consulta = await pool.request().input('id', sql.Int, idConsulta).query(`
    SELECT c.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS NombreUsuario
    FROM dbo.ConsultasUsuarios c JOIN dbo.Usuarios u ON u.IdUsuario = c.IdUsuario
    WHERE c.IdConsulta = @id
  `);
  if (!consulta.recordset[0]) return null;
  const mensajes = await pool.request().input('id', sql.Int, idConsulta).query(`
    SELECT r.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Autor
    FROM dbo.RespuestasConsulta r JOIN dbo.Usuarios u ON u.IdUsuario = r.IdUsuario
    WHERE r.IdConsulta = @id ORDER BY r.FechaRespuesta
  `);
  return { ...consulta.recordset[0], mensajes: mensajes.recordset };
}

export async function agregarMensajeConsulta(idConsulta, idUsuario, mensaje) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idConsulta)
    .input('idUsuario', sql.Int, idUsuario)
    .input('mensaje', sql.NVarChar(1000), mensaje)
    .query(`
      INSERT INTO dbo.RespuestasConsulta (IdConsulta, IdUsuario, Mensaje)
      VALUES (@id, @idUsuario, @mensaje);
      UPDATE dbo.ConsultasUsuarios
      SET Estado = CASE WHEN IdUsuario = @idUsuario THEN 'ABIERTA' ELSE 'RESPONDIDA' END
      WHERE IdConsulta = @id AND Estado <> 'CERRADA'
    `);
}

export async function listarConsultasTrabajoSocial(filtros) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('estado', sql.VarChar(20), filtros.estado || null)
    .input('buscar', sql.NVarChar(150), filtros.buscar ? `%${filtros.buscar}%` : null)
    .input('limite', sql.Int, filtros.limite)
    .input('desplazamiento', sql.Int, filtros.desplazamiento)
    .query(`
      SELECT c.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS NombreUsuario, u.Correo,
        CONCAT(ur.Nombre, ' ', ur.PrimerApellido) AS Responsable
      FROM dbo.ConsultasUsuarios c
      JOIN dbo.Usuarios u ON u.IdUsuario = c.IdUsuario
      LEFT JOIN dbo.Empleados e ON e.IdEmpleado = c.IdResponsable
      LEFT JOIN dbo.Usuarios ur ON ur.IdUsuario = e.IdUsuario
      WHERE (@estado IS NULL OR c.Estado = @estado)
        AND (@buscar IS NULL OR c.Asunto LIKE @buscar OR u.Nombre LIKE @buscar OR u.PrimerApellido LIKE @buscar)
      ORDER BY c.FechaCreacion DESC
      OFFSET @desplazamiento ROWS FETCH NEXT @limite ROWS ONLY
    `);
  return resultado.recordset;
}

export async function asignarConsulta(idConsulta, idUsuarioResponsable) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idConsulta)
    .input('idUsuario', sql.Int, idUsuarioResponsable)
    .query(`
      DECLARE @IdEmpleado INT = (SELECT IdEmpleado FROM dbo.Empleados WHERE IdUsuario = @idUsuario AND Activo = 1);
      UPDATE dbo.ConsultasUsuarios SET IdResponsable = @IdEmpleado, Estado = 'RESPONDIDA'
      WHERE IdConsulta = @id AND Estado <> 'CERRADA';
      SELECT @@ROWCOUNT AS Filas;
    `);
  return resultado.recordset[0]?.Filas > 0;
}

export async function cambiarEstadoConsulta(idConsulta, estado) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idConsulta).input('estado', sql.VarChar(20), estado).query(`
    UPDATE dbo.ConsultasUsuarios SET Estado = @estado,
      FechaCierre = CASE WHEN @estado = 'CERRADA' THEN SYSUTCDATETIME() ELSE NULL END
    WHERE IdConsulta = @id
  `);
}

export async function listarNoticias(usuario) {
  const pool = await obtenerPool();
  const esAdmin = usuario.roles.some((rol) => ['ADMINISTRADOR', 'COORDINADOR_BECAS'].includes(rol));
  const publico = usuario.roles.includes('BECADO') ? 'BECADO' : 'ASPIRANTE';
  const resultado = await pool.request()
    .input('esAdmin', sql.Bit, esAdmin)
    .input('publico', sql.VarChar(30), publico)
    .query(`
      SELECT n.*, CONCAT(u.Nombre, ' ', u.PrimerApellido) AS Autor
      FROM dbo.Noticias n JOIN dbo.Usuarios u ON u.IdUsuario = n.IdAutor
      WHERE @esAdmin = 1 OR (
        n.Estado = 'PUBLICADA' AND n.FechaPublicacion <= SYSUTCDATETIME()
        AND n.PublicoDestino IN ('GENERAL',@publico)
      )
      ORDER BY COALESCE(n.FechaPublicacion, n.FechaCreacion) DESC
    `);
  return resultado.recordset;
}

export async function obtenerNoticia(idNoticia, usuario) {
  const noticias = await listarNoticias(usuario);
  return noticias.find((noticia) => noticia.IdNoticia === idNoticia) || null;
}

export async function crearNoticia(idAutor, entrada) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('titulo', sql.NVarChar(200), entrada.titulo)
    .input('contenido', sql.NVarChar(sql.MAX), entrada.contenido)
    .input('publico', sql.VarChar(30), entrada.publicoDestino)
    .input('idAutor', sql.Int, idAutor)
    .query(`
      INSERT INTO dbo.Noticias (Titulo, Contenido, PublicoDestino, IdAutor)
      OUTPUT INSERTED.IdNoticia VALUES (@titulo, @contenido, @publico, @idAutor)
    `);
  return resultado.recordset[0].IdNoticia;
}

export async function actualizarNoticia(idNoticia, entrada) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idNoticia)
    .input('titulo', sql.NVarChar(200), entrada.titulo)
    .input('contenido', sql.NVarChar(sql.MAX), entrada.contenido)
    .input('publico', sql.VarChar(30), entrada.publicoDestino)
    .query(`
      UPDATE dbo.Noticias SET Titulo = @titulo, Contenido = @contenido,
        PublicoDestino = @publico, FechaActualizacion = SYSUTCDATETIME()
      WHERE IdNoticia = @id
    `);
}

export async function cambiarEstadoNoticia(idNoticia, estado) {
  const pool = await obtenerPool();
  await pool.request().input('id', sql.Int, idNoticia).input('estado', sql.VarChar(20), estado).query(`
    UPDATE dbo.Noticias SET Estado = @estado,
      FechaPublicacion = CASE WHEN @estado = 'PUBLICADA' THEN COALESCE(FechaPublicacion, SYSUTCDATETIME()) ELSE FechaPublicacion END,
      FechaActualizacion = SYSUTCDATETIME()
    WHERE IdNoticia = @id
  `);
}
