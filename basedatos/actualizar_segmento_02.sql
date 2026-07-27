-- =====================================================================
-- SGBE - Actualizacion incremental del Segmento 02
-- Ejecutar sobre una base creada con el script del Segmento 01.
-- No elimina datos, no usa SQL dinamico, vistas, triggers ni procedimientos.
-- =====================================================================

IF OBJECT_ID(N'dbo.Puestos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Puestos (
        IdPuesto INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL UNIQUE,
        Descripcion NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'dbo.Departamentos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departamentos (
        IdDepartamento INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL UNIQUE,
        Descripcion NVARCHAR(300) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

IF COL_LENGTH('dbo.Empleados', 'IdPuesto') IS NULL
    ALTER TABLE dbo.Empleados ADD IdPuesto INT NULL FOREIGN KEY REFERENCES dbo.Puestos(IdPuesto);
IF COL_LENGTH('dbo.Empleados', 'IdDepartamento') IS NULL
    ALTER TABLE dbo.Empleados ADD IdDepartamento INT NULL FOREIGN KEY REFERENCES dbo.Departamentos(IdDepartamento);
IF COL_LENGTH('dbo.Empleados', 'FechaActualizacion') IS NULL
    ALTER TABLE dbo.Empleados ADD FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
GO

IF COL_LENGTH('dbo.FormalizacionesBeca', 'IdResolucion') IS NULL
    ALTER TABLE dbo.FormalizacionesBeca ADD IdResolucion INT NULL FOREIGN KEY REFERENCES dbo.ResolucionesBeca(IdResolucion);
IF COL_LENGTH('dbo.FormalizacionesBeca', 'VersionCondiciones') IS NULL
    ALTER TABLE dbo.FormalizacionesBeca ADD VersionCondiciones NVARCHAR(30) NOT NULL DEFAULT '1.0';
IF COL_LENGTH('dbo.FormalizacionesBeca', 'Condiciones') IS NULL
    ALTER TABLE dbo.FormalizacionesBeca ADD Condiciones NVARCHAR(MAX) NOT NULL DEFAULT 'Condiciones institucionales pendientes de actualizar.';
GO

IF OBJECT_ID(N'dbo.AceptacionesFormalizacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AceptacionesFormalizacion (
        IdAceptacion INT IDENTITY(1,1) PRIMARY KEY,
        IdFormalizacion INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.FormalizacionesBeca(IdFormalizacion),
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        VersionCondiciones NVARCHAR(30) NOT NULL,
        DireccionIp VARCHAR(64) NULL,
        FechaAceptacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF COL_LENGTH('dbo.BecasActivas', 'Periodo') IS NULL
    ALTER TABLE dbo.BecasActivas ADD Periodo NVARCHAR(30) NOT NULL DEFAULT 'PERIODO_ACTUAL';
IF COL_LENGTH('dbo.ActivacionesFinancieras', 'Periodo') IS NULL
    ALTER TABLE dbo.ActivacionesFinancieras ADD Periodo NVARCHAR(30) NOT NULL DEFAULT 'PERIODO_ACTUAL';
IF COL_LENGTH('dbo.ActivacionesFinancieras', 'Porcentaje') IS NULL
    ALTER TABLE dbo.ActivacionesFinancieras ADD Porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.ActivacionesFinancieras', 'DetalleError') IS NULL
    ALTER TABLE dbo.ActivacionesFinancieras ADD DetalleError NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.ValidacionesAcademicas', 'Periodo') IS NULL
    ALTER TABLE dbo.ValidacionesAcademicas ADD Periodo NVARCHAR(30) NOT NULL DEFAULT 'PERIODO_ACTUAL';
GO

IF OBJECT_ID(N'dbo.AsientosFinancieros', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AsientosFinancieros (
        IdAsientoFinanciero INT IDENTITY(1,1) PRIMARY KEY,
        IdActivacionFinanciera INT NOT NULL FOREIGN KEY REFERENCES dbo.ActivacionesFinancieras(IdActivacionFinanciera),
        Referencia NVARCHAR(100) NOT NULL,
        Monto DECIMAL(12,2) NOT NULL DEFAULT 0,
        Estado VARCHAR(20) NOT NULL,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.ActualizacionesExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActualizacionesExpediente (
        IdActualizacion INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdUsuario INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Campo NVARCHAR(80) NOT NULL,
        ValorAnterior NVARCHAR(500) NULL,
        ValorNuevo NVARCHAR(500) NULL,
        RequiereRevision BIT NOT NULL DEFAULT 0,
        Revisada BIT NOT NULL DEFAULT 0,
        Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ActualizacionesExpediente_Expediente ON dbo.ActualizacionesExpediente(IdExpediente, Fecha);
END
GO

IF COL_LENGTH('dbo.AlertasSeguimiento', 'ObservacionCierre') IS NULL
    ALTER TABLE dbo.AlertasSeguimiento ADD ObservacionCierre NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.JustificacionesCurso', 'Periodo') IS NULL
    ALTER TABLE dbo.JustificacionesCurso ADD Periodo NVARCHAR(30) NOT NULL DEFAULT 'PERIODO_ACTUAL';
IF COL_LENGTH('dbo.VisitasDomiciliarias', 'Observaciones') IS NULL
    ALTER TABLE dbo.VisitasDomiciliarias ADD Observaciones NVARCHAR(600) NULL;
IF COL_LENGTH('dbo.ConsultasUsuarios', 'Mensaje') IS NOT NULL
    ALTER TABLE dbo.ConsultasUsuarios ALTER COLUMN Mensaje NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.RenovacionesBeca', 'DatosActualizados') IS NULL
    ALTER TABLE dbo.RenovacionesBeca ADD DatosActualizados NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.RenovacionesBeca', 'EstadoProceso') IS NULL
    ALTER TABLE dbo.RenovacionesBeca ADD EstadoProceso VARCHAR(25) NOT NULL DEFAULT 'BORRADOR';
IF COL_LENGTH('dbo.RenovacionesBeca', 'ResultadoDetalle') IS NULL
    ALTER TABLE dbo.RenovacionesBeca ADD ResultadoDetalle VARCHAR(20) NULL;
IF COL_LENGTH('dbo.ResolucionesRenovacion', 'ResultadoDetalle') IS NULL
    ALTER TABLE dbo.ResolucionesRenovacion ADD ResultadoDetalle VARCHAR(20) NULL;
GO

IF OBJECT_ID(N'dbo.PeriodosRenovacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeriodosRenovacion (
        IdPeriodoRenovacion INT IDENTITY(1,1) PRIMARY KEY,
        Periodo NVARCHAR(30) NOT NULL UNIQUE,
        FechaInicio DATETIME2 NOT NULL,
        FechaFin DATETIME2 NOT NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CHECK (FechaFin > FechaInicio)
    );
END
GO

IF OBJECT_ID(N'dbo.EvaluacionesRenovacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EvaluacionesRenovacion (
        IdEvaluacionRenovacion INT IDENTITY(1,1) PRIMARY KEY,
        IdRenovacion INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.RenovacionesBeca(IdRenovacion),
        IdEvaluador INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        CumpleAcademico BIT NOT NULL,
        CumpleSocioeconomico BIT NOT NULL,
        Observaciones NVARCHAR(700) NULL,
        FechaEvaluacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

INSERT INTO dbo.Permisos (Codigo, Nombre)
SELECT semilla.Codigo, semilla.Nombre
FROM (VALUES
    ('FORMALIZACION_GESTIONAR', 'Formalizar beneficio propio'),
    ('VALIDACION_ACADEMICA_GESTIONAR', 'Gestionar validacion academica'),
    ('ACTIVACION_FINANCIERA_GESTIONAR', 'Gestionar activacion financiera'),
    ('BECADO_VER_PROPIO', 'Ver panel y expediente propio'),
    ('BECADO_EDITAR_PROPIO', 'Actualizar expediente propio'),
    ('VISITA_GESTIONAR', 'Gestionar visitas domiciliarias'),
    ('CONSULTA_CREAR_PROPIA', 'Crear consultas propias'),
    ('CONSULTA_GESTIONAR', 'Gestionar consultas'),
    ('NOTICIA_GESTIONAR', 'Gestionar noticias'),
    ('SEGUIMIENTO_GESTIONAR', 'Gestionar seguimiento'),
    ('JUSTIFICACION_CREAR_PROPIA', 'Crear justificaciones propias'),
    ('JUSTIFICACION_RESOLVER', 'Resolver justificaciones'),
    ('RENOVACION_CREAR_PROPIA', 'Crear renovaciones propias'),
    ('RENOVACION_RESOLVER', 'Resolver renovaciones'),
    ('REPORTE_VER', 'Consultar reportes'),
    ('ACTA_VER', 'Consultar actas'),
    ('USUARIO_GESTIONAR', 'Gestionar usuarios'),
    ('ROL_GESTIONAR', 'Gestionar roles'),
    ('EMPLEADO_GESTIONAR', 'Gestionar empleados'),
    ('COMITE_MIEMBRO_GESTIONAR', 'Gestionar miembros del comite')
) AS semilla(Codigo, Nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos p WHERE p.Codigo = semilla.Codigo);
GO

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE
    (
      (r.Codigo = 'ASPIRANTE' AND p.Codigo IN ('FORMALIZACION_GESTIONAR','CONSULTA_CREAR_PROPIA')) OR
      (r.Codigo = 'BECADO' AND p.Codigo IN ('BECADO_VER_PROPIO','BECADO_EDITAR_PROPIO','CONSULTA_CREAR_PROPIA',
          'JUSTIFICACION_CREAR_PROPIA','RENOVACION_CREAR_PROPIA')) OR
      (r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN ('VISITA_GESTIONAR','CONSULTA_GESTIONAR',
          'SEGUIMIENTO_GESTIONAR','JUSTIFICACION_RESOLVER','RENOVACION_RESOLVER','REPORTE_VER')) OR
      (r.Codigo = 'FINANZAS' AND p.Codigo = 'ACTIVACION_FINANCIERA_GESTIONAR') OR
      (r.Codigo = 'REGISTRO_ACADEMICO' AND p.Codigo = 'VALIDACION_ACADEMICA_GESTIONAR') OR
      (r.Codigo = 'COMITE_BECAS' AND p.Codigo IN ('REPORTE_VER','ACTA_VER')) OR
      (r.Codigo = 'COORDINADOR_BECAS' AND p.Codigo IN ('REPORTE_VER','ACTA_VER','NOTICIA_GESTIONAR')) OR
      (r.Codigo = 'ADMINISTRADOR')
    )
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp
    WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO

PRINT 'Actualizacion del Segmento 02 aplicada. Para bases antiguas con restricciones CHECK de estados generadas automaticamente, valide los nuevos estados en un ambiente de prueba antes de publicar.';
GO
