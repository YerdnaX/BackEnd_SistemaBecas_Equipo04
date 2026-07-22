-- =====================================================================
-- Sistema de Gestion de Becas Estudiantiles (SGBE) - CUC
-- Script principal de base de datos (Segmentos 01, 02 y 03)
-- Motor: SQL Server
--
-- Contiene el modelo completo del sistema. En esta ejecucion solo el
-- Segmento 01 tiene API y pantallas funcionales; el resto de tablas
-- quedan preparadas para los segmentos siguientes (ver agend.md).
--
-- Reglas seguidas: sin vistas, sin triggers, sin cursores, sin SQL
-- dinamico, sin procedimientos almacenados. Puede ejecutarse mas de
-- una vez gracias a los bloques IF OBJECT_ID(...) IS NULL.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Base de datos
-- Si el usuario tiene permiso para crear la base, se crea cuando no
-- existe. Si no tiene permiso (por ejemplo en un servicio administrado
-- donde la base ya viene asignada), este bloque falla silenciosamente
-- y el resto del script se ejecuta sobre la base ya seleccionada por
-- la cadena de conexion.
-- ---------------------------------------------------------------------
IF DB_ID(N'tiusr15pl_SGBE_CUC_Equipo04') IS NULL
BEGIN
    BEGIN TRY
        EXEC(N'CREATE DATABASE tiusr15pl_SGBE_CUC_Equipo04');
    END TRY
    BEGIN CATCH
        PRINT 'No se pudo crear la base tiusr15pl_SGBE_CUC_Equipo04 (posiblemente ya existe una base asignada o el usuario no tiene permiso). Se continua sobre la base actual.';
    END CATCH
END
GO

IF DB_ID(N'tiusr15pl_SGBE_CUC_Equipo04') IS NOT NULL
BEGIN
    USE tiusr15pl_SGBE_CUC_Equipo04;
END
GO

-- =====================================================================
-- 1. IDENTIDAD, SEGURIDAD Y ADMINISTRACION
-- =====================================================================

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles (
        IdRol INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(40) NOT NULL UNIQUE,
        Nombre NVARCHAR(100) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.Permisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Permisos (
        IdPermiso INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(60) NOT NULL UNIQUE,
        Nombre NVARCHAR(120) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
        Correo NVARCHAR(150) NOT NULL UNIQUE,
        ContrasenaHash NVARCHAR(255) NOT NULL,
        Nombre NVARCHAR(100) NOT NULL,
        PrimerApellido NVARCHAR(100) NOT NULL,
        SegundoApellido NVARCHAR(100) NULL,
        Estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_ACTIVACION'
            CHECK (Estado IN ('PENDIENTE_ACTIVACION','ACTIVO','BLOQUEADO','INACTIVO')),
        CorreoVerificado BIT NOT NULL DEFAULT 0,
        IntentosFallidos INT NOT NULL DEFAULT 0,
        Activo BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Usuarios_Estado ON dbo.Usuarios(Estado);
END
GO

IF OBJECT_ID(N'dbo.UsuariosRoles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsuariosRoles (
        IdUsuarioRol INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        IdRol INT NOT NULL FOREIGN KEY REFERENCES dbo.Roles(IdRol),
        FechaAsignacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_UsuariosRoles UNIQUE (IdUsuario, IdRol)
    );
    CREATE INDEX IX_UsuariosRoles_Usuario ON dbo.UsuariosRoles(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.RolesPermisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RolesPermisos (
        IdRolPermiso INT IDENTITY(1,1) PRIMARY KEY,
        IdRol INT NOT NULL FOREIGN KEY REFERENCES dbo.Roles(IdRol),
        IdPermiso INT NOT NULL FOREIGN KEY REFERENCES dbo.Permisos(IdPermiso),
        CONSTRAINT UQ_RolesPermisos UNIQUE (IdRol, IdPermiso)
    );
END
GO

IF OBJECT_ID(N'dbo.Sesiones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sesiones (
        IdSesion INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        RefreshTokenHash NVARCHAR(255) NOT NULL,
        DireccionIp VARCHAR(64) NULL,
        AgenteUsuario NVARCHAR(255) NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaVencimiento DATETIME2 NOT NULL,
        FechaRevocacion DATETIME2 NULL,
        Activa BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_Sesiones_Usuario ON dbo.Sesiones(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.TokensActivacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TokensActivacion (
        IdTokenActivacion INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        TokenHash NVARCHAR(255) NOT NULL,
        FechaVencimiento DATETIME2 NOT NULL,
        FechaUso DATETIME2 NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_TokensActivacion_Usuario ON dbo.TokensActivacion(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.TokensRecuperacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TokensRecuperacion (
        IdTokenRecuperacion INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        TokenHash NVARCHAR(255) NOT NULL,
        FechaVencimiento DATETIME2 NOT NULL,
        FechaUso DATETIME2 NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_TokensRecuperacion_Usuario ON dbo.TokensRecuperacion(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.RetosDosFactores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RetosDosFactores (
        IdReto INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        CodigoHash NVARCHAR(255) NOT NULL,
        Intentos INT NOT NULL DEFAULT 0,
        FechaVencimiento DATETIME2 NOT NULL,
        FechaUso DATETIME2 NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_RetosDosFactores_Usuario ON dbo.RetosDosFactores(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.Empleados', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Empleados (
        IdEmpleado INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        NumeroEmpleado NVARCHAR(30) NULL,
        Puesto NVARCHAR(100) NULL,
        Departamento NVARCHAR(100) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ComitesBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ComitesBeca (
        IdComite INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(150) NOT NULL,
        Periodo NVARCHAR(50) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.MiembrosComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MiembrosComite (
        IdMiembroComite INT IDENTITY(1,1) PRIMARY KEY,
        IdComite INT NOT NULL FOREIGN KEY REFERENCES dbo.ComitesBeca(IdComite),
        IdEmpleado INT NOT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        Cargo NVARCHAR(100) NULL,
        FechaInicio DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaFin DATETIME2 NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_MiembrosComite_Comite ON dbo.MiembrosComite(IdComite);
END
GO

IF OBJECT_ID(N'dbo.AuditoriaAcciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditoriaAcciones (
        IdAuditoria INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Modulo NVARCHAR(60) NOT NULL,
        Accion NVARCHAR(60) NOT NULL,
        Entidad NVARCHAR(60) NULL,
        IdEntidad INT NULL,
        Detalle NVARCHAR(1000) NULL,
        DireccionIp VARCHAR(64) NULL,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_AuditoriaAcciones_Fecha ON dbo.AuditoriaAcciones(Fecha);
    CREATE INDEX IX_AuditoriaAcciones_Entidad ON dbo.AuditoriaAcciones(Entidad, IdEntidad);
END
GO

IF OBJECT_ID(N'dbo.EventosSeguridad', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventosSeguridad (
        IdEventoSeguridad INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        TipoEvento NVARCHAR(60) NOT NULL,
        Descripcion NVARCHAR(500) NULL,
        Nivel VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (Nivel IN ('INFO','ADVERTENCIA','CRITICO')),
        DireccionIp VARCHAR(64) NULL,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Revisado BIT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_EventosSeguridad_Fecha ON dbo.EventosSeguridad(Fecha);
END
GO

-- =====================================================================
-- 2. TIPOS, CONFIGURACION Y CONVOCATORIAS
-- =====================================================================

IF OBJECT_ID(N'dbo.TiposBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TiposBeca (
        IdTipoBeca INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(500) NULL,
        PorcentajeCobertura DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (PorcentajeCobertura BETWEEN 0 AND 100),
        Activo BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_TiposBeca_Activo ON dbo.TiposBeca(Activo);
END
GO

IF OBJECT_ID(N'dbo.RubrosCobertura', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RubrosCobertura (
        IdRubro INT IDENTITY(1,1) PRIMARY KEY,
        IdTipoBeca INT NOT NULL FOREIGN KEY REFERENCES dbo.TiposBeca(IdTipoBeca),
        Nombre NVARCHAR(100) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (Porcentaje BETWEEN 0 AND 100),
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_RubrosCobertura_TipoBeca ON dbo.RubrosCobertura(IdTipoBeca);
END
GO

IF OBJECT_ID(N'dbo.CriteriosElegibilidad', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CriteriosElegibilidad (
        IdCriterio INT IDENTITY(1,1) PRIMARY KEY,
        IdTipoBeca INT NOT NULL FOREIGN KEY REFERENCES dbo.TiposBeca(IdTipoBeca),
        Nombre NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(400) NULL,
        Obligatorio BIT NOT NULL DEFAULT 1,
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_CriteriosElegibilidad_TipoBeca ON dbo.CriteriosElegibilidad(IdTipoBeca);
END
GO

IF OBJECT_ID(N'dbo.TiposDocumento', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TiposDocumento (
        IdTipoDocumento INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(40) NOT NULL UNIQUE,
        Nombre NVARCHAR(120) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.Convocatorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Convocatorias (
        IdConvocatoria INT IDENTITY(1,1) PRIMARY KEY,
        IdTipoBeca INT NOT NULL FOREIGN KEY REFERENCES dbo.TiposBeca(IdTipoBeca),
        Nombre NVARCHAR(200) NOT NULL,
        Descripcion NVARCHAR(1000) NULL,
        FechaInicio DATETIME2 NOT NULL,
        FechaFin DATETIME2 NOT NULL,
        Cupos INT NOT NULL CHECK (Cupos > 0),
        Presupuesto DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (Presupuesto >= 0),
        Estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR'
            CHECK (Estado IN ('BORRADOR','PENDIENTE_APROBACION','APROBADA','PUBLICADA','CERRADA','CANCELADA')),
        IdCreadoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        IdAprobadoPor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaPublicacion DATETIME2 NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Convocatorias_Fechas CHECK (FechaFin > FechaInicio)
    );
    CREATE INDEX IX_Convocatorias_Estado ON dbo.Convocatorias(Estado);
    CREATE INDEX IX_Convocatorias_Fechas ON dbo.Convocatorias(FechaInicio, FechaFin);
END
GO

IF OBJECT_ID(N'dbo.RequisitosConvocatoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequisitosConvocatoria (
        IdRequisito INT IDENTITY(1,1) PRIMARY KEY,
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        Nombre NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(400) NULL,
        IdTipoDocumento INT NULL FOREIGN KEY REFERENCES dbo.TiposDocumento(IdTipoDocumento),
        Obligatorio BIT NOT NULL DEFAULT 1,
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_RequisitosConvocatoria_Convocatoria ON dbo.RequisitosConvocatoria(IdConvocatoria);
END
GO

IF OBJECT_ID(N'dbo.EtapasConvocatoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EtapasConvocatoria (
        IdEtapa INT IDENTITY(1,1) PRIMARY KEY,
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        TipoEtapa VARCHAR(30) NOT NULL
            CHECK (TipoEtapa IN ('RECEPCION','REVISION_DOCUMENTAL','EVALUACION','COMITE','RESULTADOS')),
        FechaInicio DATETIME2 NOT NULL,
        FechaFin DATETIME2 NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA'
            CHECK (Estado IN ('PROGRAMADA','ABIERTA','CERRADA')),
        IdModificadoPor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_EtapasConvocatoria UNIQUE (IdConvocatoria, TipoEtapa)
    );
    CREATE INDEX IX_EtapasConvocatoria_Convocatoria ON dbo.EtapasConvocatoria(IdConvocatoria);
    CREATE INDEX IX_EtapasConvocatoria_Estado ON dbo.EtapasConvocatoria(Estado);
END
GO

IF OBJECT_ID(N'dbo.HistorialEtapasConvocatoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialEtapasConvocatoria (
        IdHistorialEtapa INT IDENTITY(1,1) PRIMARY KEY,
        IdEtapa INT NOT NULL FOREIGN KEY REFERENCES dbo.EtapasConvocatoria(IdEtapa),
        EstadoAnterior VARCHAR(20) NULL,
        EstadoNuevo VARCHAR(20) NOT NULL,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Observacion NVARCHAR(400) NULL,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_HistorialEtapasConvocatoria_Etapa ON dbo.HistorialEtapasConvocatoria(IdEtapa);
END
GO

IF OBJECT_ID(N'dbo.ConfiguracionesSistema', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConfiguracionesSistema (
        IdConfiguracion INT IDENTITY(1,1) PRIMARY KEY,
        Clave NVARCHAR(80) NOT NULL UNIQUE,
        Valor NVARCHAR(400) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        TipoDato VARCHAR(20) NOT NULL DEFAULT 'TEXTO' CHECK (TipoDato IN ('TEXTO','NUMERO','BOOLEANO','FECHA')),
        Activo BIT NOT NULL DEFAULT 1,
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.PlantillasMensajes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlantillasMensajes (
        IdPlantilla INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(60) NOT NULL UNIQUE,
        Asunto NVARCHAR(200) NOT NULL,
        Contenido NVARCHAR(MAX) NOT NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- =====================================================================
-- 3. SOLICITUDES, ARCHIVOS Y EXPEDIENTES
-- =====================================================================

IF OBJECT_ID(N'dbo.Archivos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Archivos (
        IdArchivo INT IDENTITY(1,1) PRIMARY KEY,
        NombreOriginal NVARCHAR(255) NOT NULL,
        NombreInterno NVARCHAR(255) NOT NULL,
        TipoMime NVARCHAR(120) NOT NULL,
        Extension VARCHAR(10) NOT NULL,
        TamanoBytes BIGINT NOT NULL CHECK (TamanoBytes > 0),
        Contenido VARBINARY(MAX) NULL,
        UrlExterna NVARCHAR(500) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.Solicitudes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Solicitudes (
        IdSolicitud INT IDENTITY(1,1) PRIMARY KEY,
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR'
            CHECK (Estado IN ('BORRADOR','ENVIADA','EN_REVISION_DOCUMENTAL','PENDIENTE_SUBSANACION',
                               'ELEGIBLE','NO_ELEGIBLE','EN_EVALUACION','EVALUADA','EN_COMITE',
                               'APROBADA','CONDICIONADA','LISTA_ESPERA','RECHAZADA')),
        Progreso INT NOT NULL DEFAULT 0 CHECK (Progreso BETWEEN 0 AND 100),
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaEnvio DATETIME2 NULL,
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Solicitudes_Usuario_Convocatoria UNIQUE (IdUsuario, IdConvocatoria)
    );
    CREATE INDEX IX_Solicitudes_Estado ON dbo.Solicitudes(Estado);
    CREATE INDEX IX_Solicitudes_Usuario ON dbo.Solicitudes(IdUsuario);
END
GO

IF OBJECT_ID(N'dbo.DatosPersonalesSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DatosPersonalesSolicitud (
        IdDatosPersonales INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        Identificacion NVARCHAR(30) NOT NULL,
        FechaNacimiento DATETIME2 NOT NULL,
        Telefono NVARCHAR(30) NOT NULL,
        Direccion NVARCHAR(300) NOT NULL,
        ContactoEmergencia NVARCHAR(150) NULL,
        TelefonoEmergencia NVARCHAR(30) NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DatosAcademicosSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DatosAcademicosSolicitud (
        IdDatosAcademicos INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        NumeroEstudiante NVARCHAR(30) NOT NULL,
        Carrera NVARCHAR(150) NOT NULL,
        NivelAcademico NVARCHAR(60) NOT NULL,
        Promedio DECIMAL(5,2) NOT NULL CHECK (Promedio BETWEEN 0 AND 100),
        CreditosMatriculados INT NOT NULL DEFAULT 0 CHECK (CreditosMatriculados >= 0),
        CondicionAcademica NVARCHAR(60) NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DatosSocioeconomicosSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DatosSocioeconomicosSolicitud (
        IdDatosSocioeconomicos INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        TipoVivienda NVARCHAR(60) NOT NULL,
        CantidadIntegrantes INT NOT NULL CHECK (CantidadIntegrantes > 0),
        IngresoMensual DECIMAL(12,2) NOT NULL CHECK (IngresoMensual >= 0),
        GastoMensual DECIMAL(12,2) NOT NULL CHECK (GastoMensual >= 0),
        SituacionLaboral NVARCHAR(60) NOT NULL,
        Observaciones NVARCHAR(500) NULL
    );
END
GO

IF OBJECT_ID(N'dbo.MiembrosGrupoFamiliar', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MiembrosGrupoFamiliar (
        IdMiembroFamiliar INT IDENTITY(1,1) PRIMARY KEY,
        IdDatosSocioeconomicos INT NOT NULL FOREIGN KEY REFERENCES dbo.DatosSocioeconomicosSolicitud(IdDatosSocioeconomicos),
        Nombre NVARCHAR(150) NOT NULL,
        Parentesco NVARCHAR(60) NOT NULL,
        Edad INT NOT NULL CHECK (Edad >= 0),
        Ocupacion NVARCHAR(100) NULL,
        IngresoMensual DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (IngresoMensual >= 0),
        DependeEconomicamente BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_MiembrosGrupoFamiliar_Datos ON dbo.MiembrosGrupoFamiliar(IdDatosSocioeconomicos);
END
GO

IF OBJECT_ID(N'dbo.DocumentosSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosSolicitud (
        IdDocumentoSolicitud INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        IdRequisito INT NULL FOREIGN KEY REFERENCES dbo.RequisitosConvocatoria(IdRequisito),
        IdTipoDocumento INT NULL FOREIGN KEY REFERENCES dbo.TiposDocumento(IdTipoDocumento),
        IdArchivo INT NOT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        Estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
            CHECK (Estado IN ('PENDIENTE','VALIDO','RECHAZADO','REQUIERE_SUBSANACION')),
        VersionActual INT NOT NULL DEFAULT 1,
        FechaCarga DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_DocumentosSolicitud_Solicitud ON dbo.DocumentosSolicitud(IdSolicitud);
    CREATE INDEX IX_DocumentosSolicitud_Estado ON dbo.DocumentosSolicitud(Estado);
END
GO

IF OBJECT_ID(N'dbo.RevisionesDocumento', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RevisionesDocumento (
        IdRevisionDocumento INT IDENTITY(1,1) PRIMARY KEY,
        IdDocumentoSolicitud INT NOT NULL FOREIGN KEY REFERENCES dbo.DocumentosSolicitud(IdDocumentoSolicitud),
        IdRevisor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        EstadoAnterior VARCHAR(30) NULL,
        EstadoNuevo VARCHAR(30) NOT NULL,
        Observacion NVARCHAR(500) NULL,
        FechaRevision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_RevisionesDocumento_Documento ON dbo.RevisionesDocumento(IdDocumentoSolicitud);
END
GO

IF OBJECT_ID(N'dbo.Expedientes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Expedientes (
        IdExpediente INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        CodigoExpediente NVARCHAR(30) NOT NULL UNIQUE,
        Estado VARCHAR(30) NOT NULL DEFAULT 'EN_REVISION_DOCUMENTAL'
            CHECK (Estado IN ('EN_REVISION_DOCUMENTAL','PENDIENTE_SUBSANACION','ELEGIBLE','NO_ELEGIBLE',
                               'EN_EVALUACION','EVALUADA','EN_COMITE','APROBADA','CONDICIONADA',
                               'LISTA_ESPERA','RECHAZADA')),
        Prioridad VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (Prioridad IN ('BAJA','NORMAL','ALTA')),
        FechaApertura DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaCierre DATETIME2 NULL,
        SoloLectura BIT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_Expedientes_Estado ON dbo.Expedientes(Estado);
END
GO

IF OBJECT_ID(N'dbo.HistorialEstadosExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialEstadosExpediente (
        IdHistorialEstado INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        EstadoAnterior VARCHAR(30) NULL,
        EstadoNuevo VARCHAR(30) NOT NULL,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Observacion NVARCHAR(500) NULL,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_HistorialEstadosExpediente_Expediente ON dbo.HistorialEstadosExpediente(IdExpediente);
END
GO

IF OBJECT_ID(N'dbo.AsignacionesExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AsignacionesExpediente (
        IdAsignacion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdEmpleado INT NOT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        IdAsignadoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaAsignacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaFin DATETIME2 NULL,
        Activa BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_AsignacionesExpediente_Expediente ON dbo.AsignacionesExpediente(IdExpediente);
    CREATE INDEX IX_AsignacionesExpediente_Empleado ON dbo.AsignacionesExpediente(IdEmpleado);
END
GO

IF OBJECT_ID(N'dbo.ElegibilidadesExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ElegibilidadesExpediente (
        IdElegibilidad INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        EsElegible BIT NOT NULL,
        Motivo NVARCHAR(500) NULL,
        IdResueltoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaResolucion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ElegibilidadesExpediente_Expediente ON dbo.ElegibilidadesExpediente(IdExpediente);
END
GO

-- =====================================================================
-- 4. EVALUACION, RANKING Y COMITE
-- =====================================================================

IF OBJECT_ID(N'dbo.ComponentesEvaluacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ComponentesEvaluacion (
        IdComponente INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(40) NOT NULL UNIQUE,
        Nombre NVARCHAR(120) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Porcentaje DECIMAL(5,2) NOT NULL CHECK (Porcentaje BETWEEN 0 AND 100),
        PuntajeMaximo DECIMAL(5,2) NOT NULL DEFAULT 100,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.EvaluacionesExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EvaluacionesExpediente (
        IdEvaluacion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdEvaluador INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR'
            CHECK (Estado IN ('BORRADOR','COMPLETA','ENVIADA_COMITE')),
        PuntajeTotal DECIMAL(6,2) NULL,
        Observaciones NVARCHAR(600) NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaFinalizacion DATETIME2 NULL
    );
    CREATE INDEX IX_EvaluacionesExpediente_Expediente ON dbo.EvaluacionesExpediente(IdExpediente);
END
GO

IF OBJECT_ID(N'dbo.PuntajesEvaluacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PuntajesEvaluacion (
        IdPuntaje INT IDENTITY(1,1) PRIMARY KEY,
        IdEvaluacion INT NOT NULL FOREIGN KEY REFERENCES dbo.EvaluacionesExpediente(IdEvaluacion),
        IdComponente INT NOT NULL FOREIGN KEY REFERENCES dbo.ComponentesEvaluacion(IdComponente),
        Puntaje DECIMAL(5,2) NOT NULL CHECK (Puntaje >= 0),
        PorcentajeAplicado DECIMAL(5,2) NOT NULL,
        PuntajePonderado DECIMAL(6,2) NOT NULL,
        Observacion NVARCHAR(400) NULL,
        CONSTRAINT UQ_PuntajesEvaluacion UNIQUE (IdEvaluacion, IdComponente)
    );
    CREATE INDEX IX_PuntajesEvaluacion_Evaluacion ON dbo.PuntajesEvaluacion(IdEvaluacion);
END
GO

IF OBJECT_ID(N'dbo.RankingsConvocatoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RankingsConvocatoria (
        IdRanking INT IDENTITY(1,1) PRIMARY KEY,
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        PuntajeTotal DECIMAL(6,2) NOT NULL,
        Posicion INT NOT NULL,
        FechaCalculo DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_RankingsConvocatoria UNIQUE (IdConvocatoria, IdExpediente)
    );
    CREATE INDEX IX_RankingsConvocatoria_Convocatoria ON dbo.RankingsConvocatoria(IdConvocatoria, Posicion);
END
GO

IF OBJECT_ID(N'dbo.SesionesComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SesionesComite (
        IdSesionComite INT IDENTITY(1,1) PRIMARY KEY,
        IdComite INT NOT NULL FOREIGN KEY REFERENCES dbo.ComitesBeca(IdComite),
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        Nombre NVARCHAR(150) NOT NULL,
        FechaSesion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (Estado IN ('ABIERTA','CERRADA','ANULADA')),
        IdCreadoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaCierre DATETIME2 NULL
    );
    CREATE INDEX IX_SesionesComite_Convocatoria ON dbo.SesionesComite(IdConvocatoria);
    CREATE INDEX IX_SesionesComite_Estado ON dbo.SesionesComite(Estado);
END
GO

IF OBJECT_ID(N'dbo.CasosSesionComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CasosSesionComite (
        IdCasoSesion INT IDENTITY(1,1) PRIMARY KEY,
        IdSesionComite INT NOT NULL FOREIGN KEY REFERENCES dbo.SesionesComite(IdSesionComite),
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        OrdenRevision INT NOT NULL DEFAULT 0,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','DECIDIDO')),
        FechaInclusion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CasosSesionComite UNIQUE (IdSesionComite, IdExpediente)
    );
    CREATE INDEX IX_CasosSesionComite_Sesion ON dbo.CasosSesionComite(IdSesionComite);
END
GO

IF OBJECT_ID(N'dbo.DecisionesComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DecisionesComite (
        IdDecision INT IDENTITY(1,1) PRIMARY KEY,
        IdCasoSesion INT NOT NULL FOREIGN KEY REFERENCES dbo.CasosSesionComite(IdCasoSesion),
        TipoDecision VARCHAR(20) NOT NULL
            CHECK (TipoDecision IN ('APROBADA','CONDICIONADA','LISTA_ESPERA','RECHAZADA')),
        PorcentajeBeca DECIMAL(5,2) NULL CHECK (PorcentajeBeca IS NULL OR PorcentajeBeca BETWEEN 0 AND 100),
        Motivo NVARCHAR(600) NULL,
        IdRegistradoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaDecision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Vigente BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_DecisionesComite_Caso ON dbo.DecisionesComite(IdCasoSesion);
END
GO

IF OBJECT_ID(N'dbo.ResolucionesBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResolucionesBeca (
        IdResolucion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdDecision INT NOT NULL FOREIGN KEY REFERENCES dbo.DecisionesComite(IdDecision),
        NumeroResolucion NVARCHAR(40) NOT NULL UNIQUE,
        TipoResultado VARCHAR(20) NOT NULL
            CHECK (TipoResultado IN ('APROBADA','CONDICIONADA','LISTA_ESPERA','RECHAZADA')),
        PorcentajeBeca DECIMAL(5,2) NULL,
        Motivo NVARCHAR(600) NULL,
        Contenido NVARCHAR(MAX) NULL,
        FechaEmision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Publicada BIT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_ResolucionesBeca_Expediente ON dbo.ResolucionesBeca(IdExpediente);
END
GO

IF OBJECT_ID(N'dbo.ActasComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActasComite (
        IdActa INT IDENTITY(1,1) PRIMARY KEY,
        IdSesionComite INT NOT NULL FOREIGN KEY REFERENCES dbo.SesionesComite(IdSesionComite),
        NumeroActa NVARCHAR(40) NOT NULL UNIQUE,
        Contenido NVARCHAR(MAX) NULL,
        IdArchivo INT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        FechaGeneracion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.Notificaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notificaciones (
        IdNotificacion INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Tipo NVARCHAR(60) NOT NULL,
        Titulo NVARCHAR(150) NOT NULL,
        Mensaje NVARCHAR(600) NOT NULL,
        Enlace NVARCHAR(300) NULL,
        Leida BIT NOT NULL DEFAULT 0,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaLectura DATETIME2 NULL
    );
    CREATE INDEX IX_Notificaciones_Usuario ON dbo.Notificaciones(IdUsuario, Leida);
END
GO

IF OBJECT_ID(N'dbo.EnviosCorreo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EnviosCorreo (
        IdEnvioCorreo INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        CorreoDestino NVARCHAR(150) NOT NULL,
        Asunto NVARCHAR(200) NOT NULL,
        TipoMensaje NVARCHAR(60) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','ENVIADO','FALLIDO')),
        Intentos INT NOT NULL DEFAULT 0,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaEnvio DATETIME2 NULL,
        Error NVARCHAR(500) NULL
    );
    CREATE INDEX IX_EnviosCorreo_Estado ON dbo.EnviosCorreo(Estado);
END
GO

-- =====================================================================
-- 5. FORMALIZACION Y ACTIVACION FINANCIERA (segmento 02, tablas preparadas)
-- =====================================================================

IF OBJECT_ID(N'dbo.FormalizacionesBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FormalizacionesBeca (
        IdFormalizacion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','GENERADA','ACEPTADA','RECHAZADA')),
        FechaGeneracion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaAceptacion DATETIME2 NULL,
        Observacion NVARCHAR(400) NULL
    );
END
GO

IF OBJECT_ID(N'dbo.ConveniosBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConveniosBeca (
        IdConvenio INT IDENTITY(1,1) PRIMARY KEY,
        IdFormalizacion INT NOT NULL FOREIGN KEY REFERENCES dbo.FormalizacionesBeca(IdFormalizacion),
        NumeroConvenio NVARCHAR(40) NOT NULL UNIQUE,
        Contenido NVARCHAR(MAX) NULL,
        IdArchivo INT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        Firmado BIT NOT NULL DEFAULT 0,
        FechaFirma DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.BecasActivas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BecasActivas (
        IdBecaActiva INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdTipoBeca INT NOT NULL FOREIGN KEY REFERENCES dbo.TiposBeca(IdTipoBeca),
        Porcentaje DECIMAL(5,2) NOT NULL CHECK (Porcentaje BETWEEN 0 AND 100),
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_ACTIVACION'
            CHECK (Estado IN ('PENDIENTE_ACTIVACION','ACTIVA','SUSPENDIDA','FINALIZADA','CANCELADA')),
        FechaInicio DATETIME2 NULL,
        FechaFin DATETIME2 NULL,
        FechaActivacion DATETIME2 NULL
    );
    CREATE INDEX IX_BecasActivas_Estado ON dbo.BecasActivas(Estado);
END
GO

IF OBJECT_ID(N'dbo.ActivacionesFinancieras', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivacionesFinancieras (
        IdActivacionFinanciera INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','VERIFICADA','RECHAZADA')),
        Monto DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (Monto >= 0),
        Referencia NVARCHAR(100) NULL,
        IdEmpleadoFinanzas INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaRegistro DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaVerificacion DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.ValidacionesAcademicas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValidacionesAcademicas (
        IdValidacionAcademica INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','VALIDADA','RECHAZADA')),
        Detalle NVARCHAR(400) NULL,
        IdEmpleadoRegistro INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaValidacion DATETIME2 NULL
    );
END
GO

-- =====================================================================
-- 6. SEGUIMIENTO, VISITAS, CONSULTAS Y NOTICIAS
-- =====================================================================

IF OBJECT_ID(N'dbo.SeguimientosBecado', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SeguimientosBecado (
        IdSeguimiento INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        Periodo NVARCHAR(30) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','CUMPLE','NO_CUMPLE')),
        Observaciones NVARCHAR(500) NULL,
        IdResponsable INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaRevision DATETIME2 NULL
    );
    CREATE INDEX IX_SeguimientosBecado_Beca ON dbo.SeguimientosBecado(IdBecaActiva);
END
GO

IF OBJECT_ID(N'dbo.RendimientosAcademicos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RendimientosAcademicos (
        IdRendimiento INT IDENTITY(1,1) PRIMARY KEY,
        IdSeguimiento INT NOT NULL FOREIGN KEY REFERENCES dbo.SeguimientosBecado(IdSeguimiento),
        Promedio DECIMAL(5,2) NOT NULL CHECK (Promedio BETWEEN 0 AND 100),
        CreditosMatriculados INT NOT NULL DEFAULT 0,
        CreditosAprobados INT NOT NULL DEFAULT 0,
        CursosPerdidos INT NOT NULL DEFAULT 0,
        CumpleRequisitos BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.AlertasSeguimiento', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AlertasSeguimiento (
        IdAlerta INT IDENTITY(1,1) PRIMARY KEY,
        IdSeguimiento INT NOT NULL FOREIGN KEY REFERENCES dbo.SeguimientosBecado(IdSeguimiento),
        Tipo NVARCHAR(60) NOT NULL,
        Descripcion NVARCHAR(400) NULL,
        Nivel VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (Nivel IN ('INFO','ADVERTENCIA','CRITICO')),
        Estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (Estado IN ('ABIERTA','ATENDIDA')),
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaAtencion DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.JustificacionesCurso', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.JustificacionesCurso (
        IdJustificacion INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        Curso NVARCHAR(150) NOT NULL,
        Motivo NVARCHAR(500) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
        IdResueltoPor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Resolucion NVARCHAR(500) NULL,
        FechaSolicitud DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaResolucion DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DocumentosJustificacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosJustificacion (
        IdDocumentoJustificacion INT IDENTITY(1,1) PRIMARY KEY,
        IdJustificacion INT NOT NULL FOREIGN KEY REFERENCES dbo.JustificacionesCurso(IdJustificacion),
        IdArchivo INT NOT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        FechaCarga DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.VisitasDomiciliarias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitasDomiciliarias (
        IdVisita INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdResponsable INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaProgramada DATETIME2 NOT NULL,
        Direccion NVARCHAR(300) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA' CHECK (Estado IN ('PROGRAMADA','REALIZADA','CANCELADA')),
        FechaRealizada DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.InformesVisita', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InformesVisita (
        IdInformeVisita INT IDENTITY(1,1) PRIMARY KEY,
        IdVisita INT NOT NULL FOREIGN KEY REFERENCES dbo.VisitasDomiciliarias(IdVisita),
        Resultado NVARCHAR(60) NOT NULL,
        Observaciones NVARCHAR(600) NULL,
        IdArchivo INT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        FechaRegistro DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ConsultasUsuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConsultasUsuarios (
        IdConsulta INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Asunto NVARCHAR(150) NOT NULL,
        Mensaje NVARCHAR(1000) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (Estado IN ('ABIERTA','RESPONDIDA','CERRADA')),
        IdResponsable INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaCierre DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.RespuestasConsulta', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RespuestasConsulta (
        IdRespuesta INT IDENTITY(1,1) PRIMARY KEY,
        IdConsulta INT NOT NULL FOREIGN KEY REFERENCES dbo.ConsultasUsuarios(IdConsulta),
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Mensaje NVARCHAR(1000) NOT NULL,
        FechaRespuesta DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.Noticias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Noticias (
        IdNoticia INT IDENTITY(1,1) PRIMARY KEY,
        Titulo NVARCHAR(200) NOT NULL,
        Contenido NVARCHAR(MAX) NOT NULL,
        PublicoDestino VARCHAR(30) NOT NULL DEFAULT 'GENERAL' CHECK (PublicoDestino IN ('GENERAL','ASPIRANTE','BECADO')),
        Estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR' CHECK (Estado IN ('BORRADOR','PUBLICADA','ARCHIVADA')),
        IdAutor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaPublicacion DATETIME2 NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Noticias_Estado ON dbo.Noticias(Estado, FechaPublicacion);
END
GO

-- =====================================================================
-- 7. RENOVACION, APELACION, SUSPENSION Y CIERRE (segmento 03, preparadas)
-- =====================================================================

IF OBJECT_ID(N'dbo.RenovacionesBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RenovacionesBeca (
        IdRenovacion INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        Periodo NVARCHAR(30) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
        FechaSolicitud DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaResolucion DATETIME2 NULL,
        IdResueltoPor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario)
    );
END
GO

IF OBJECT_ID(N'dbo.DocumentosRenovacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosRenovacion (
        IdDocumentoRenovacion INT IDENTITY(1,1) PRIMARY KEY,
        IdRenovacion INT NOT NULL FOREIGN KEY REFERENCES dbo.RenovacionesBeca(IdRenovacion),
        IdArchivo INT NOT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        IdTipoDocumento INT NULL FOREIGN KEY REFERENCES dbo.TiposDocumento(IdTipoDocumento),
        FechaCarga DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ResolucionesRenovacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResolucionesRenovacion (
        IdResolucionRenovacion INT IDENTITY(1,1) PRIMARY KEY,
        IdRenovacion INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.RenovacionesBeca(IdRenovacion),
        Resultado VARCHAR(20) NOT NULL CHECK (Resultado IN ('APROBADA','RECHAZADA')),
        PorcentajeNuevo DECIMAL(5,2) NULL,
        Motivo NVARCHAR(500) NULL,
        FechaEmision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.Apelaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Apelaciones (
        IdApelacion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdResolucion INT NULL FOREIGN KEY REFERENCES dbo.ResolucionesBeca(IdResolucion),
        Motivo NVARCHAR(800) NOT NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'PRESENTADA'
            CHECK (Estado IN ('PRESENTADA','EN_REVISION','RESUELTA')),
        FechaPresentacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaLimite DATETIME2 NULL,
        IdRevisor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario)
    );
END
GO

IF OBJECT_ID(N'dbo.DocumentosApelacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosApelacion (
        IdDocumentoApelacion INT IDENTITY(1,1) PRIMARY KEY,
        IdApelacion INT NOT NULL FOREIGN KEY REFERENCES dbo.Apelaciones(IdApelacion),
        IdArchivo INT NOT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        FechaCarga DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.RevisionesApelacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RevisionesApelacion (
        IdRevisionApelacion INT IDENTITY(1,1) PRIMARY KEY,
        IdApelacion INT NOT NULL FOREIGN KEY REFERENCES dbo.Apelaciones(IdApelacion),
        IdRevisor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Observaciones NVARCHAR(600) NULL,
        FechaRevision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ResolucionesApelacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResolucionesApelacion (
        IdResolucionApelacion INT IDENTITY(1,1) PRIMARY KEY,
        IdApelacion INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Apelaciones(IdApelacion),
        Resultado VARCHAR(20) NOT NULL CHECK (Resultado IN ('CONFIRMADA','MODIFICADA','REVOCADA')),
        Motivo NVARCHAR(600) NULL,
        FechaEmision DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        IdResueltoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario)
    );
END
GO

IF OBJECT_ID(N'dbo.InvestigacionesBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvestigacionesBeca (
        IdInvestigacion INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        Causal NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(600) NULL,
        Estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (Estado IN ('ABIERTA','EN_REVISION','CERRADA')),
        IdResponsable INT NULL FOREIGN KEY REFERENCES dbo.Empleados(IdEmpleado),
        FechaApertura DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaCierre DATETIME2 NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DescargosBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DescargosBeca (
        IdDescargo INT IDENTITY(1,1) PRIMARY KEY,
        IdInvestigacion INT NOT NULL FOREIGN KEY REFERENCES dbo.InvestigacionesBeca(IdInvestigacion),
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Detalle NVARCHAR(800) NOT NULL,
        IdArchivo INT NULL FOREIGN KEY REFERENCES dbo.Archivos(IdArchivo),
        FechaPresentacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ResolucionesSuspension', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResolucionesSuspension (
        IdResolucionSuspension INT IDENTITY(1,1) PRIMARY KEY,
        IdInvestigacion INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.InvestigacionesBeca(IdInvestigacion),
        Resultado VARCHAR(20) NOT NULL CHECK (Resultado IN ('SUSPENDIDA','CANCELADA','SIN_MERITO')),
        Motivo NVARCHAR(600) NULL,
        IdResueltoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaResolucion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.HistorialEstadosBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialEstadosBeca (
        IdHistorialBeca INT IDENTITY(1,1) PRIMARY KEY,
        IdBecaActiva INT NOT NULL FOREIGN KEY REFERENCES dbo.BecasActivas(IdBecaActiva),
        EstadoAnterior VARCHAR(20) NULL,
        EstadoNuevo VARCHAR(20) NOT NULL,
        Motivo NVARCHAR(400) NULL,
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.CierresExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CierresExpediente (
        IdCierre INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        Motivo NVARCHAR(400) NOT NULL,
        Resumen NVARCHAR(800) NULL,
        IdCerradoPor INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaCierre DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- =====================================================================
-- 8. CHATBOT
-- =====================================================================

IF OBJECT_ID(N'dbo.PreguntasRespuestasChatbot', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PreguntasRespuestasChatbot (
        IdPreguntaRespuesta INT IDENTITY(1,1) PRIMARY KEY,
        Pregunta NVARCHAR(300) NOT NULL,
        Respuesta NVARCHAR(1000) NOT NULL,
        Categoria NVARCHAR(80) NULL,
        PalabrasClave NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        IdAutor INT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- =====================================================================
-- 9. DATOS SEMILLA (no sensibles)
-- =====================================================================

-- Roles
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'ASPIRANTE')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('ASPIRANTE', 'Aspirante', 'Persona que postula a una beca');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'BECADO')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('BECADO', 'Becado', 'Estudiante con beca activa (segmento posterior)');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'TRABAJADORA_SOCIAL')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('TRABAJADORA_SOCIAL', 'Trabajadora Social', 'Revisa documentos, elegibilidad y evaluacion');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'COORDINADOR_BECAS')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('COORDINADOR_BECAS', 'Coordinador de Becas', 'Supervisa convocatorias y expedientes');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'COMITE_BECAS')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('COMITE_BECAS', 'Comite de Becas', 'Resuelve casos en sesion');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'FINANZAS')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('FINANZAS', 'Finanzas', 'Activacion financiera (segmento posterior)');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'REGISTRO_ACADEMICO')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('REGISTRO_ACADEMICO', 'Registro Academico', 'Validacion academica (segmento posterior)');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Codigo = 'ADMINISTRADOR')
    INSERT INTO dbo.Roles (Codigo, Nombre, Descripcion) VALUES ('ADMINISTRADOR', 'Administrador', 'Administracion general del sistema');
GO

-- Permisos del Segmento 01
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos)
BEGIN
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES
        ('TIPO_BECA_VER', 'Ver tipos de beca'),
        ('TIPO_BECA_CREAR', 'Crear tipos de beca'),
        ('TIPO_BECA_EDITAR', 'Editar tipos de beca'),
        ('CONVOCATORIA_VER', 'Ver convocatorias'),
        ('CONVOCATORIA_CREAR', 'Crear convocatorias'),
        ('CONVOCATORIA_EDITAR', 'Editar convocatorias'),
        ('CONVOCATORIA_APROBAR', 'Aprobar convocatorias'),
        ('CONVOCATORIA_PUBLICAR', 'Publicar convocatorias'),
        ('ETAPA_GESTIONAR', 'Gestionar etapas de convocatoria'),
        ('SOLICITUD_CREAR', 'Crear solicitud propia'),
        ('SOLICITUD_EDITAR_PROPIA', 'Editar solicitud propia'),
        ('SOLICITUD_ENVIAR_PROPIA', 'Enviar solicitud propia'),
        ('SOLICITUD_VER_PROPIA', 'Ver solicitud propia'),
        ('DOCUMENTO_CARGAR_PROPIO', 'Cargar documentos propios'),
        ('EXPEDIENTE_LISTAR', 'Listar expedientes'),
        ('EXPEDIENTE_ASIGNAR', 'Asignar expedientes'),
        ('DOCUMENTO_REVISAR', 'Revisar documentos de expediente'),
        ('ELEGIBILIDAD_RESOLVER', 'Resolver elegibilidad'),
        ('EVALUACION_REGISTRAR', 'Registrar evaluacion integral'),
        ('COMITE_SESIONAR', 'Crear y gestionar sesiones de comite'),
        ('COMITE_RESOLVER', 'Registrar decisiones de comite'),
        ('RESULTADO_VER_PROPIO', 'Ver resultado propio');
END
GO

-- Relaciones rol-permiso
IF NOT EXISTS (SELECT 1 FROM dbo.RolesPermisos)
BEGIN
    INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM dbo.Roles r, dbo.Permisos p
    WHERE r.Codigo = 'ASPIRANTE' AND p.Codigo IN
        ('CONVOCATORIA_VER','SOLICITUD_CREAR','SOLICITUD_EDITAR_PROPIA','SOLICITUD_ENVIAR_PROPIA',
         'SOLICITUD_VER_PROPIA','DOCUMENTO_CARGAR_PROPIO','RESULTADO_VER_PROPIO');

    INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM dbo.Roles r, dbo.Permisos p
    WHERE r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN
        ('CONVOCATORIA_VER','EXPEDIENTE_LISTAR','EXPEDIENTE_ASIGNAR','DOCUMENTO_REVISAR',
         'ELEGIBILIDAD_RESOLVER','EVALUACION_REGISTRAR');

    INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM dbo.Roles r, dbo.Permisos p
    WHERE r.Codigo = 'COORDINADOR_BECAS' AND p.Codigo IN
        ('TIPO_BECA_VER','TIPO_BECA_CREAR','TIPO_BECA_EDITAR','CONVOCATORIA_VER','CONVOCATORIA_CREAR',
         'CONVOCATORIA_EDITAR','CONVOCATORIA_APROBAR','CONVOCATORIA_PUBLICAR','ETAPA_GESTIONAR',
         'EXPEDIENTE_LISTAR','EXPEDIENTE_ASIGNAR');

    INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM dbo.Roles r, dbo.Permisos p
    WHERE r.Codigo = 'COMITE_BECAS' AND p.Codigo IN
        ('CONVOCATORIA_VER','EXPEDIENTE_LISTAR','COMITE_SESIONAR','COMITE_RESOLVER');

    INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
    SELECT r.IdRol, p.IdPermiso FROM dbo.Roles r, dbo.Permisos p
    WHERE r.Codigo = 'ADMINISTRADOR';
END
GO

-- Tipos de documento basicos
IF NOT EXISTS (SELECT 1 FROM dbo.TiposDocumento)
BEGIN
    INSERT INTO dbo.TiposDocumento (Codigo, Nombre, Descripcion) VALUES
        ('IDENTIFICACION', 'Identificacion', 'Cedula o documento de identidad vigente'),
        ('CONSTANCIA_SALARIAL', 'Constancia salarial', 'Constancia de ingresos del hogar'),
        ('CERTIFICACION', 'Certificacion', 'Certificacion institucional o medica'),
        ('HISTORIAL_ACADEMICO', 'Historial academico', 'Historial o informe de calificaciones'),
        ('COMPROBANTE_DOMICILIO', 'Comprobante de domicilio', 'Recibo de servicio publico reciente'),
        ('OTRO', 'Otro respaldo', 'Documento de respaldo adicional');
END
GO

-- Componentes de evaluacion (pesos provisionales, ver DECISIONES_SEGMENTO_01.md)
IF NOT EXISTS (SELECT 1 FROM dbo.ComponentesEvaluacion)
BEGIN
    INSERT INTO dbo.ComponentesEvaluacion (Codigo, Nombre, Descripcion, Porcentaje, PuntajeMaximo) VALUES
        ('ACADEMICO', 'Academico', 'Rendimiento academico del aspirante', 40.00, 100),
        ('SOCIOECONOMICO', 'Socioeconomico', 'Condicion socioeconomica del grupo familiar', 40.00, 100),
        ('MERITOS', 'Meritos', 'Meritos, actividades y reconocimientos adicionales', 20.00, 100);
END
GO

-- Configuraciones no sensibles
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'OTP_DURACION_MINUTOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('OTP_DURACION_MINUTOS', '10', 'Minutos de vigencia del codigo 2FA', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'OTP_INTENTOS_MAXIMOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('OTP_INTENTOS_MAXIMOS', '5', 'Intentos maximos de verificacion 2FA', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'TOKEN_ACTIVACION_HORAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('TOKEN_ACTIVACION_HORAS', '24', 'Horas de vigencia del token de activacion de cuenta', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'TOKEN_RECUPERACION_HORAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('TOKEN_RECUPERACION_HORAS', '24', 'Horas de vigencia del token de recuperacion de contrasena', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'TAMANO_MAXIMO_ARCHIVO_MB')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('TAMANO_MAXIMO_ARCHIVO_MB', '8', 'Tamano maximo de archivo cargado en megabytes', 'NUMERO');

-- La noticia publica de ejemplo (dato semilla) requiere un autor (Usuarios.IdAutor
-- es NOT NULL) y por eso no puede insertarse aqui, antes de que exista un usuario.
-- Se crea automaticamente por BackEnd/scripts/crearAdministrador.js junto con el
-- administrador inicial (ver Backend/basedatos/README_BASE_DATOS.md).
GO

PRINT 'Script de base de datos SGBE_CUC_Equipo04 ejecutado correctamente.';
GO
