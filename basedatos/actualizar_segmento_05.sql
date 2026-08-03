-- =====================================================================
-- SGBE - Actualizacion incremental del Segmento 05
-- Ejecutar sobre una base creada con crear_base_datos.sql (y con los
-- segmentos 02, 03 y 04 ya aplicados).
-- No elimina datos, no usa SQL dinamico, vistas, triggers ni
-- procedimientos almacenados.
--
-- Cubre:
--   - Cedula como identificador de la cuenta de usuario (nullable, unica
--     cuando existe, para no romper usuarios ya creados sin cedula).
--   - Requisitos de beca reutilizables (plantilla por TipoBeca) que se
--     copian a RequisitosConvocatoria al crear cada convocatoria.
--   - Notas simuladas del aspirante (informacion de prueba, no oficial).
--   - Permisos nuevos de gestion de requisitos/criterios de beca.
--   - Traslado de la gestion operativa de becas y convocatorias de
--     ADMINISTRADOR/COORDINADOR_BECAS hacia TRABAJADORA_SOCIAL; los
--     primeros conservan solo lectura (TIPO_BECA_VER/CONVOCATORIA_VER).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cedula en Usuarios
-- ---------------------------------------------------------------------

IF COL_LENGTH('dbo.Usuarios', 'Cedula') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD Cedula CHAR(9) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_Usuarios_Cedula' AND object_id = OBJECT_ID('dbo.Usuarios')
)
BEGIN
    CREATE UNIQUE INDEX UQ_Usuarios_Cedula ON dbo.Usuarios(Cedula) WHERE Cedula IS NOT NULL;
END
GO

-- ---------------------------------------------------------------------
-- 2. Requisitos por beca (plantilla reutilizable por convocatoria)
-- ---------------------------------------------------------------------

IF OBJECT_ID(N'dbo.RequisitosBeca', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequisitosBeca (
        IdRequisitoBeca INT IDENTITY(1,1) PRIMARY KEY,
        IdTipoBeca INT NOT NULL FOREIGN KEY REFERENCES dbo.TiposBeca(IdTipoBeca),
        Nombre NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(400) NULL,
        IdTipoDocumento INT NULL FOREIGN KEY REFERENCES dbo.TiposDocumento(IdTipoDocumento),
        Obligatorio BIT NOT NULL DEFAULT 1,
        Activo BIT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_RequisitosBeca_TipoBeca ON dbo.RequisitosBeca(IdTipoBeca);
END
GO

-- ---------------------------------------------------------------------
-- 3. Notas simuladas de la solicitud
-- ---------------------------------------------------------------------

IF OBJECT_ID(N'dbo.NotasSimuladasSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.NotasSimuladasSolicitud (
        IdNotasSimuladas INT IDENTITY(1,1) PRIMARY KEY,
        IdSolicitud INT NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.Solicitudes(IdSolicitud),
        Promedio DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (Promedio BETWEEN 0 AND 100),
        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.MateriasNotaSimulada', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MateriasNotaSimulada (
        IdMateriaNota INT IDENTITY(1,1) PRIMARY KEY,
        IdNotasSimuladas INT NOT NULL FOREIGN KEY REFERENCES dbo.NotasSimuladasSolicitud(IdNotasSimuladas),
        NombreMateria NVARCHAR(150) NOT NULL,
        Nota DECIMAL(5,2) NOT NULL CHECK (Nota BETWEEN 0 AND 100),
        Periodo NVARCHAR(50) NOT NULL
    );
    CREATE INDEX IX_MateriasNotaSimulada_Notas ON dbo.MateriasNotaSimulada(IdNotasSimuladas);
END
GO

-- ---------------------------------------------------------------------
-- 4. Permisos nuevos
-- ---------------------------------------------------------------------

INSERT INTO dbo.Permisos (Codigo, Nombre)
SELECT semilla.Codigo, semilla.Nombre
FROM (VALUES
    ('REQUISITO_BECA_GESTIONAR', 'Gestionar requisitos de beca'),
    ('CRITERIO_BECA_GESTIONAR', 'Gestionar criterios de elegibilidad de beca')
) AS semilla(Codigo, Nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos p WHERE p.Codigo = semilla.Codigo);
GO

-- ---------------------------------------------------------------------
-- 5. Traslado de gestion de becas/convocatorias a Trabajadora Social
-- ---------------------------------------------------------------------

-- Trabajadora Social gana gestion operativa completa de becas y convocatorias.
INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN
    ('TIPO_BECA_CREAR','TIPO_BECA_EDITAR','CONVOCATORIA_CREAR','CONVOCATORIA_EDITAR',
     'CONVOCATORIA_APROBAR','CONVOCATORIA_PUBLICAR','ETAPA_GESTIONAR',
     'REQUISITO_BECA_GESTIONAR','CRITERIO_BECA_GESTIONAR')
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp
    WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO

-- Administrador y Coordinador de Becas conservan solo lectura.
INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE r.Codigo IN ('ADMINISTRADOR','COORDINADOR_BECAS') AND p.Codigo IN ('TIPO_BECA_VER','CONVOCATORIA_VER')
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp
    WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO

-- Administrador pierde gestion operativa de becas/convocatorias. ADMINISTRADOR
-- recibe todos los permisos por la regla generica de la semilla original
-- (crear_base_datos.sql), por lo que aqui se revoca explicitamente por
-- codigo. Para revertir: volver a ejecutar el INSERT equivalente al de
-- Trabajadora Social arriba pero con r.Codigo = 'ADMINISTRADOR'.
DELETE rp
FROM dbo.RolesPermisos rp
JOIN dbo.Roles r ON r.IdRol = rp.IdRol
JOIN dbo.Permisos p ON p.IdPermiso = rp.IdPermiso
WHERE r.Codigo IN ('ADMINISTRADOR','COORDINADOR_BECAS') AND p.Codigo IN
    ('TIPO_BECA_CREAR','TIPO_BECA_EDITAR','CONVOCATORIA_CREAR','CONVOCATORIA_EDITAR',
     'CONVOCATORIA_APROBAR','CONVOCATORIA_PUBLICAR','ETAPA_GESTIONAR');
GO
