-- Evaluacion automatica, quintiles, decision grupal e informes sociales.
-- Migracion incremental e idempotente. No elimina informacion existente.

IF COL_LENGTH('dbo.Convocatorias', 'Periodo') IS NULL
    ALTER TABLE dbo.Convocatorias ADD Periodo NVARCHAR(30) NULL;
GO

UPDATE dbo.Convocatorias
SET Periodo = CONCAT(YEAR(FechaInicio), '-', CASE WHEN MONTH(FechaInicio) <= 6 THEN 'I' ELSE 'II' END)
WHERE Periodo IS NULL OR LTRIM(RTRIM(Periodo)) = '';
GO

UPDATE dbo.Convocatorias
SET Periodo = CASE
    WHEN Nombre LIKE '%[12][0-9][0-9][0-9]-III%' THEN SUBSTRING(Nombre, PATINDEX('%[12][0-9][0-9][0-9]-III%', Nombre), 8)
    WHEN Nombre LIKE '%[12][0-9][0-9][0-9]-II%' THEN SUBSTRING(Nombre, PATINDEX('%[12][0-9][0-9][0-9]-II%', Nombre), 7)
    WHEN Nombre LIKE '%[12][0-9][0-9][0-9]-I%' THEN SUBSTRING(Nombre, PATINDEX('%[12][0-9][0-9][0-9]-I%', Nombre), 6)
    ELSE Periodo
END
WHERE Nombre LIKE '%[12][0-9][0-9][0-9]-I%';
GO

IF COL_LENGTH('dbo.EvaluacionesExpediente', 'Origen') IS NULL
    ALTER TABLE dbo.EvaluacionesExpediente ADD Origen VARCHAR(20) NOT NULL CONSTRAINT DF_Evaluaciones_Origen DEFAULT 'MANUAL';
IF COL_LENGTH('dbo.EvaluacionesExpediente', 'QuintilCalculado') IS NULL
    ALTER TABLE dbo.EvaluacionesExpediente ADD QuintilCalculado TINYINT NULL;
IF COL_LENGTH('dbo.DecisionesComite', 'EsGrupal') IS NULL
    ALTER TABLE dbo.DecisionesComite ADD EsGrupal BIT NOT NULL CONSTRAINT DF_DecisionesComite_EsGrupal DEFAULT 0;
GO

IF OBJECT_ID(N'dbo.UmbralesQuintilCostaRica', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UmbralesQuintilCostaRica (
        IdUmbralQuintil INT IDENTITY(1,1) PRIMARY KEY,
        AnioReferencia SMALLINT NOT NULL UNIQUE,
        MaximoQ1 DECIMAL(12,2) NOT NULL,
        MaximoQ2 DECIMAL(12,2) NOT NULL,
        MaximoQ3 DECIMAL(12,2) NOT NULL,
        MaximoQ4 DECIMAL(12,2) NOT NULL,
        Fuente NVARCHAR(500) NOT NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaRegistro DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_UmbralesQuintil_Orden CHECK (MaximoQ1 < MaximoQ2 AND MaximoQ2 < MaximoQ3 AND MaximoQ3 < MaximoQ4)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.UmbralesQuintilCostaRica WHERE AnioReferencia = 2025)
    INSERT INTO dbo.UmbralesQuintilCostaRica
      (AnioReferencia, MaximoQ1, MaximoQ2, MaximoQ3, MaximoQ4, Fuente)
    VALUES
      (2025, 96749, 165513, 274326, 506559,
       N'INEC Costa Rica, Encuesta Nacional de Hogares 2025, variable Q_IPCN');
GO

IF OBJECT_ID(N'dbo.PrecalculosQuintil', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PrecalculosQuintil (
        IdPrecalculoQuintil INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdConvocatoria INT NOT NULL FOREIGN KEY REFERENCES dbo.Convocatorias(IdConvocatoria),
        Periodo NVARCHAR(30) NOT NULL,
        IngresoHogar DECIMAL(12,2) NOT NULL,
        CantidadIntegrantes INT NOT NULL,
        IngresoPerCapita DECIMAL(12,2) NOT NULL,
        Quintil TINYINT NOT NULL CHECK (Quintil BETWEEN 1 AND 5),
        EsElegible BIT NOT NULL,
        Metodo VARCHAR(40) NOT NULL DEFAULT 'INEC_ENAHO_NACIONAL',
        AnioReferencia SMALLINT NULL,
        Fuente NVARCHAR(500) NULL,
        FechaCalculo DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_PrecalculosQuintil_Convocatoria ON dbo.PrecalculosQuintil(IdConvocatoria, Quintil);
END
GO

IF COL_LENGTH('dbo.PrecalculosQuintil', 'AnioReferencia') IS NULL
    ALTER TABLE dbo.PrecalculosQuintil ADD AnioReferencia SMALLINT NULL;
IF COL_LENGTH('dbo.PrecalculosQuintil', 'Fuente') IS NULL
    ALTER TABLE dbo.PrecalculosQuintil ADD Fuente NVARCHAR(500) NULL;
GO

UPDATE pq
SET Quintil = CASE
      WHEN pq.IngresoPerCapita <= u.MaximoQ1 THEN 1
      WHEN pq.IngresoPerCapita <= u.MaximoQ2 THEN 2
      WHEN pq.IngresoPerCapita <= u.MaximoQ3 THEN 3
      WHEN pq.IngresoPerCapita <= u.MaximoQ4 THEN 4
      ELSE 5
    END,
    EsElegible = CASE WHEN pq.IngresoPerCapita <= u.MaximoQ2 THEN 1 ELSE 0 END,
    Metodo = 'INEC_ENAHO_NACIONAL',
    AnioReferencia = u.AnioReferencia,
    Fuente = u.Fuente,
    Periodo = c.Periodo,
    FechaCalculo = SYSUTCDATETIME()
FROM dbo.PrecalculosQuintil pq
JOIN dbo.Expedientes e ON e.IdExpediente = pq.IdExpediente
JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
CROSS JOIN (
    SELECT TOP 1 * FROM dbo.UmbralesQuintilCostaRica WHERE Activo = 1 ORDER BY AnioReferencia DESC
) u;
GO

IF OBJECT_ID(N'dbo.InformesSocialesExpediente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InformesSocialesExpediente (
        IdInformeSocial INT IDENTITY(1,1) PRIMARY KEY,
        IdExpediente INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Expedientes(IdExpediente),
        IdTrabajadorSocial INT NOT NULL FOREIGN KEY REFERENCES dbo.Usuarios(IdUsuario),
        Resumen NVARCHAR(1200) NOT NULL,
        Hallazgos NVARCHAR(2000) NOT NULL,
        Recomendacion VARCHAR(20) NOT NULL CHECK (Recomendacion IN ('FAVORABLE','CONDICIONADA','DESFAVORABLE')),
        Observaciones NVARCHAR(1000) NULL,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.MiembrosSesionComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MiembrosSesionComite (
        IdMiembroSesion INT IDENTITY(1,1) PRIMARY KEY,
        IdSesionComite INT NOT NULL FOREIGN KEY REFERENCES dbo.SesionesComite(IdSesionComite),
        IdMiembroComite INT NOT NULL FOREIGN KEY REFERENCES dbo.MiembrosComite(IdMiembroComite),
        CONSTRAINT UQ_MiembrosSesionComite UNIQUE (IdSesionComite, IdMiembroComite)
    );
    CREATE INDEX IX_MiembrosSesionComite_Sesion ON dbo.MiembrosSesionComite(IdSesionComite);
END
GO

IF OBJECT_ID(N'dbo.VotosComite', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VotosComite (
        IdVotoComite INT IDENTITY(1,1) PRIMARY KEY,
        IdCasoSesion INT NOT NULL FOREIGN KEY REFERENCES dbo.CasosSesionComite(IdCasoSesion),
        IdMiembroComite INT NOT NULL FOREIGN KEY REFERENCES dbo.MiembrosComite(IdMiembroComite),
        TipoDecision VARCHAR(20) NOT NULL CHECK (TipoDecision IN ('APROBADA','CONDICIONADA','LISTA_ESPERA','RECHAZADA')),
        Motivo NVARCHAR(600) NULL,
        FechaVoto DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_VotosComite_CasoMiembro UNIQUE (IdCasoSesion, IdMiembroComite)
    );
    CREATE INDEX IX_VotosComite_Caso ON dbo.VotosComite(IdCasoSesion, TipoDecision);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'INFORME_SOCIAL_GESTIONAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('INFORME_SOCIAL_GESTIONAR', 'Crear y actualizar informes sociales');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'INFORME_SOCIAL_VER')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('INFORME_SOCIAL_VER', 'Consultar informes sociales');
GO

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE (
    (r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN ('INFORME_SOCIAL_GESTIONAR','INFORME_SOCIAL_VER')) OR
    (r.Codigo = 'COMITE_BECAS' AND p.Codigo = 'INFORME_SOCIAL_VER') OR
    (r.Codigo = 'ADMINISTRADOR' AND p.Codigo IN ('INFORME_SOCIAL_GESTIONAR','INFORME_SOCIAL_VER'))
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO

PRINT 'Actualizacion de evaluacion, quintiles y comite aplicada.';
GO
