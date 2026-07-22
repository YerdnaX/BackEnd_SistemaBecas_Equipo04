import { obtenerPool, sql } from '../../configuracion/baseDatos.js';

export async function obtenerSolicitudPorId(idSolicitud) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idSolicitud)
    .query(`
      SELECT s.*, c.Nombre AS NombreConvocatoria, c.IdTipoBeca, c.Estado AS EstadoConvocatoria
      FROM dbo.Solicitudes s JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
      WHERE s.IdSolicitud = @id
    `);
  return resultado.recordset[0] || null;
}

export async function obtenerSolicitudActivaUsuarioConvocatoria(idUsuario, idConvocatoria) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('idConvocatoria', sql.Int, idConvocatoria)
    .query('SELECT * FROM dbo.Solicitudes WHERE IdUsuario = @idUsuario AND IdConvocatoria = @idConvocatoria');
  return resultado.recordset[0] || null;
}

export async function listarSolicitudesUsuario(idUsuario) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT s.*, c.Nombre AS NombreConvocatoria
      FROM dbo.Solicitudes s JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
      WHERE s.IdUsuario = @idUsuario ORDER BY s.FechaCreacion DESC
    `);
  return resultado.recordset;
}

export async function crearSolicitud(idUsuario, idConvocatoria) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('idConvocatoria', sql.Int, idConvocatoria)
    .query(`
      INSERT INTO dbo.Solicitudes (IdConvocatoria, IdUsuario)
      OUTPUT INSERTED.IdSolicitud
      VALUES (@idConvocatoria, @idUsuario)
    `);
  return resultado.recordset[0].IdSolicitud;
}

export async function obtenerDatosCompletos(idSolicitud) {
  const pool = await obtenerPool();

  const personales = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT * FROM dbo.DatosPersonalesSolicitud WHERE IdSolicitud = @id');
  const academicos = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT * FROM dbo.DatosAcademicosSolicitud WHERE IdSolicitud = @id');
  const socioeconomicos = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT * FROM dbo.DatosSocioeconomicosSolicitud WHERE IdSolicitud = @id');

  let miembrosFamiliares = [];
  if (socioeconomicos.recordset[0]) {
    const miembros = await pool.request()
      .input('idDatos', sql.Int, socioeconomicos.recordset[0].IdDatosSocioeconomicos)
      .query('SELECT * FROM dbo.MiembrosGrupoFamiliar WHERE IdDatosSocioeconomicos = @idDatos');
    miembrosFamiliares = miembros.recordset;
  }

  return {
    datosPersonales: personales.recordset[0] || null,
    datosAcademicos: academicos.recordset[0] || null,
    datosSocioeconomicos: socioeconomicos.recordset[0]
      ? { ...socioeconomicos.recordset[0], miembrosFamiliares }
      : null
  };
}

export async function guardarDatosPersonales(idSolicitud, datos) {
  const pool = await obtenerPool();
  const existente = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT IdDatosPersonales FROM dbo.DatosPersonalesSolicitud WHERE IdSolicitud = @id');

  const solicitud = pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .input('identificacion', sql.NVarChar(30), datos.identificacion)
    .input('fechaNacimiento', sql.DateTime2, datos.fechaNacimiento)
    .input('telefono', sql.NVarChar(30), datos.telefono)
    .input('direccion', sql.NVarChar(300), datos.direccion)
    .input('contactoEmergencia', sql.NVarChar(150), datos.contactoEmergencia || null)
    .input('telefonoEmergencia', sql.NVarChar(30), datos.telefonoEmergencia || null);

  if (existente.recordset[0]) {
    await solicitud.query(`
      UPDATE dbo.DatosPersonalesSolicitud SET Identificacion = @identificacion, FechaNacimiento = @fechaNacimiento,
        Telefono = @telefono, Direccion = @direccion, ContactoEmergencia = @contactoEmergencia,
        TelefonoEmergencia = @telefonoEmergencia
      WHERE IdSolicitud = @idSolicitud
    `);
  } else {
    await solicitud.query(`
      INSERT INTO dbo.DatosPersonalesSolicitud
        (IdSolicitud, Identificacion, FechaNacimiento, Telefono, Direccion, ContactoEmergencia, TelefonoEmergencia)
      VALUES (@idSolicitud, @identificacion, @fechaNacimiento, @telefono, @direccion, @contactoEmergencia, @telefonoEmergencia)
    `);
  }
}

export async function guardarDatosAcademicos(idSolicitud, datos) {
  const pool = await obtenerPool();
  const existente = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT IdDatosAcademicos FROM dbo.DatosAcademicosSolicitud WHERE IdSolicitud = @id');

  const solicitud = pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .input('numeroEstudiante', sql.NVarChar(30), datos.numeroEstudiante)
    .input('carrera', sql.NVarChar(150), datos.carrera)
    .input('nivelAcademico', sql.NVarChar(60), datos.nivelAcademico)
    .input('promedio', sql.Decimal(5, 2), datos.promedio)
    .input('creditosMatriculados', sql.Int, datos.creditosMatriculados || 0)
    .input('condicionAcademica', sql.NVarChar(60), datos.condicionAcademica || null);

  if (existente.recordset[0]) {
    await solicitud.query(`
      UPDATE dbo.DatosAcademicosSolicitud SET NumeroEstudiante = @numeroEstudiante, Carrera = @carrera,
        NivelAcademico = @nivelAcademico, Promedio = @promedio, CreditosMatriculados = @creditosMatriculados,
        CondicionAcademica = @condicionAcademica
      WHERE IdSolicitud = @idSolicitud
    `);
  } else {
    await solicitud.query(`
      INSERT INTO dbo.DatosAcademicosSolicitud
        (IdSolicitud, NumeroEstudiante, Carrera, NivelAcademico, Promedio, CreditosMatriculados, CondicionAcademica)
      VALUES (@idSolicitud, @numeroEstudiante, @carrera, @nivelAcademico, @promedio, @creditosMatriculados, @condicionAcademica)
    `);
  }
}

export async function guardarDatosSocioeconomicos(idSolicitud, datos) {
  const pool = await obtenerPool();
  const existente = await pool.request().input('id', sql.Int, idSolicitud)
    .query('SELECT IdDatosSocioeconomicos FROM dbo.DatosSocioeconomicosSolicitud WHERE IdSolicitud = @id');

  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    let idDatosSocioeconomicos;
    const solicitud = transaccion.request()
      .input('idSolicitud', sql.Int, idSolicitud)
      .input('tipoVivienda', sql.NVarChar(60), datos.tipoVivienda)
      .input('cantidadIntegrantes', sql.Int, datos.cantidadIntegrantes)
      .input('ingresoMensual', sql.Decimal(12, 2), datos.ingresoMensual)
      .input('gastoMensual', sql.Decimal(12, 2), datos.gastoMensual)
      .input('situacionLaboral', sql.NVarChar(60), datos.situacionLaboral)
      .input('observaciones', sql.NVarChar(500), datos.observaciones || null);

    if (existente.recordset[0]) {
      idDatosSocioeconomicos = existente.recordset[0].IdDatosSocioeconomicos;
      await solicitud.query(`
        UPDATE dbo.DatosSocioeconomicosSolicitud SET TipoVivienda = @tipoVivienda,
          CantidadIntegrantes = @cantidadIntegrantes, IngresoMensual = @ingresoMensual,
          GastoMensual = @gastoMensual, SituacionLaboral = @situacionLaboral, Observaciones = @observaciones
        WHERE IdSolicitud = @idSolicitud
      `);
      await transaccion.request().input('id', sql.Int, idDatosSocioeconomicos)
        .query('DELETE FROM dbo.MiembrosGrupoFamiliar WHERE IdDatosSocioeconomicos = @id');
    } else {
      const resultado = await solicitud.query(`
        INSERT INTO dbo.DatosSocioeconomicosSolicitud
          (IdSolicitud, TipoVivienda, CantidadIntegrantes, IngresoMensual, GastoMensual, SituacionLaboral, Observaciones)
        OUTPUT INSERTED.IdDatosSocioeconomicos
        VALUES (@idSolicitud, @tipoVivienda, @cantidadIntegrantes, @ingresoMensual, @gastoMensual, @situacionLaboral, @observaciones)
      `);
      idDatosSocioeconomicos = resultado.recordset[0].IdDatosSocioeconomicos;
    }

    for (const miembro of datos.miembrosFamiliares || []) {
      await transaccion.request()
        .input('idDatos', sql.Int, idDatosSocioeconomicos)
        .input('nombre', sql.NVarChar(150), miembro.nombre)
        .input('parentesco', sql.NVarChar(60), miembro.parentesco)
        .input('edad', sql.Int, miembro.edad)
        .input('ocupacion', sql.NVarChar(100), miembro.ocupacion || null)
        .input('ingresoMensual', sql.Decimal(12, 2), miembro.ingresoMensual || 0)
        .input('dependeEconomicamente', sql.Bit, miembro.dependeEconomicamente !== false)
        .query(`
          INSERT INTO dbo.MiembrosGrupoFamiliar
            (IdDatosSocioeconomicos, Nombre, Parentesco, Edad, Ocupacion, IngresoMensual, DependeEconomicamente)
          VALUES (@idDatos, @nombre, @parentesco, @edad, @ocupacion, @ingresoMensual, @dependeEconomicamente)
        `);
    }

    await transaccion.commit();
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}

export async function actualizarProgreso(idSolicitud, progreso) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idSolicitud)
    .input('progreso', sql.Int, progreso)
    .query('UPDATE dbo.Solicitudes SET Progreso = @progreso, FechaActualizacion = SYSUTCDATETIME() WHERE IdSolicitud = @id');
}

// --- Documentos ---

export async function listarDocumentos(idSolicitud) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idSolicitud)
    .query(`
      SELECT d.*, r.Nombre AS NombreRequisito, r.Obligatorio, a.NombreOriginal, a.TipoMime, a.TamanoBytes
      FROM dbo.DocumentosSolicitud d
      LEFT JOIN dbo.RequisitosConvocatoria r ON r.IdRequisito = d.IdRequisito
      JOIN dbo.Archivos a ON a.IdArchivo = d.IdArchivo
      WHERE d.IdSolicitud = @id AND d.Activo = 1
      ORDER BY d.FechaCarga DESC
    `);
  return resultado.recordset;
}

export async function obtenerDocumentoPorId(idDocumentoSolicitud) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('id', sql.Int, idDocumentoSolicitud)
    .query('SELECT * FROM dbo.DocumentosSolicitud WHERE IdDocumentoSolicitud = @id AND Activo = 1');
  return resultado.recordset[0] || null;
}

export async function agregarDocumento({ idSolicitud, idRequisito, idTipoDocumento, idArchivo }) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .input('idRequisito', sql.Int, idRequisito || null)
    .input('idTipoDocumento', sql.Int, idTipoDocumento || null)
    .input('idArchivo', sql.Int, idArchivo)
    .query(`
      INSERT INTO dbo.DocumentosSolicitud (IdSolicitud, IdRequisito, IdTipoDocumento, IdArchivo)
      OUTPUT INSERTED.IdDocumentoSolicitud
      VALUES (@idSolicitud, @idRequisito, @idTipoDocumento, @idArchivo)
    `);
  return resultado.recordset[0].IdDocumentoSolicitud;
}

export async function eliminarDocumentoLogico(idDocumentoSolicitud) {
  const pool = await obtenerPool();
  await pool.request()
    .input('id', sql.Int, idDocumentoSolicitud)
    .query('UPDATE dbo.DocumentosSolicitud SET Activo = 0 WHERE IdDocumentoSolicitud = @id');
}

export async function obtenerResolucionPublicada(idSolicitud) {
  const pool = await obtenerPool();
  const resultado = await pool.request()
    .input('idSolicitud', sql.Int, idSolicitud)
    .query(`
      SELECT rb.* FROM dbo.ResolucionesBeca rb
      JOIN dbo.Expedientes e ON e.IdExpediente = rb.IdExpediente
      WHERE e.IdSolicitud = @idSolicitud AND rb.Publicada = 1
    `);
  return resultado.recordset[0] || null;
}

// --- Envio de solicitud (transaccion) ---

export async function enviarSolicitudTransaccion(idSolicitud) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    const codigoExpediente = `EXP-${idSolicitud}-${Date.now().toString().slice(-6)}`;

    await transaccion.request()
      .input('id', sql.Int, idSolicitud)
      .query(`
        UPDATE dbo.Solicitudes SET Estado = 'ENVIADA', Progreso = 100, FechaEnvio = SYSUTCDATETIME(),
          FechaActualizacion = SYSUTCDATETIME()
        WHERE IdSolicitud = @id
      `);

    const expediente = await transaccion.request()
      .input('idSolicitud', sql.Int, idSolicitud)
      .input('codigo', sql.NVarChar(30), codigoExpediente)
      .query(`
        INSERT INTO dbo.Expedientes (IdSolicitud, CodigoExpediente)
        OUTPUT INSERTED.IdExpediente
        VALUES (@idSolicitud, @codigo)
      `);
    const idExpediente = expediente.recordset[0].IdExpediente;

    await transaccion.request()
      .input('idExpediente', sql.Int, idExpediente)
      .input('idSolicitud', sql.Int, idSolicitud)
      .query(`
        INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
        SELECT @idExpediente, NULL, 'EN_REVISION_DOCUMENTAL', s.IdUsuario, 'Expediente generado al enviar la solicitud.'
        FROM dbo.Solicitudes s WHERE s.IdSolicitud = @idSolicitud
      `);

    await transaccion.commit();
    return idExpediente;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
}
