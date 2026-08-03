-- =====================================================================
-- SGBE - Actualizacion incremental del Segmento 04 (Integrante 3)
-- Ejecutar sobre una base creada con crear_base_datos.sql.
-- No elimina datos, no usa SQL dinamico, vistas, triggers ni procedimientos.
--
-- Cubre:
--   - Categoria de noticias, para colorearlas/agruparlas por tema (tarea 20).
--   - Permiso de solo lectura de convocatorias/becas para Trabajadora Social,
--     ya existia CONVOCATORIA_VER pero se deja explicito en este segmento
--     junto con TIPO_BECA_VER (tarea 21).
-- =====================================================================

IF COL_LENGTH('dbo.Noticias', 'Categoria') IS NULL
BEGIN
    ALTER TABLE dbo.Noticias ADD Categoria VARCHAR(20) NOT NULL
        CONSTRAINT DF_Noticias_Categoria DEFAULT 'GENERAL';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Noticias_Categoria'
)
BEGIN
    ALTER TABLE dbo.Noticias ADD CONSTRAINT CK_Noticias_Categoria
        CHECK (Categoria IN ('ACADEMICA','FINANCIERA','CONVOCATORIA','EVENTO','URGENTE','GENERAL'));
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_Noticias_Categoria' AND object_id = OBJECT_ID('dbo.Noticias')
)
BEGIN
    CREATE INDEX IX_Noticias_Categoria ON dbo.Noticias(Categoria);
END
GO

-- Trabajadora Social ya cuenta con CONVOCATORIA_VER; se agrega TIPO_BECA_VER
-- para que pueda consultar el detalle de becas asociadas a cada convocatoria.
INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo = 'TIPO_BECA_VER'
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp
    WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO
