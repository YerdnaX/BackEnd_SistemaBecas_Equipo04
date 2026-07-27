-- =====================================================================
-- SGBE - Actualizacion incremental del Segmento 03
-- Ejecutar sobre una base creada con crear_base_datos.sql.
-- No elimina datos, no usa SQL dinamico, vistas, triggers ni procedimientos.
-- =====================================================================

IF COL_LENGTH('dbo.EnviosCorreo', 'ContenidoHtml') IS NULL
    ALTER TABLE dbo.EnviosCorreo ADD ContenidoHtml NVARCHAR(MAX) NULL;
GO

INSERT INTO dbo.Permisos (Codigo, Nombre)
SELECT semilla.Codigo, semilla.Nombre
FROM (VALUES
    ('APELACION_CREAR_PROPIA', 'Presentar apelacion propia'),
    ('APELACION_LISTAR', 'Listar y ver apelaciones'),
    ('APELACION_ASIGNAR', 'Asignar revisor de apelacion'),
    ('APELACION_RESOLVER', 'Resolver apelacion'),
    ('DISCIPLINARIO_GESTIONAR', 'Abrir y resolver procesos disciplinarios (suspension/cancelacion)'),
    ('DESCARGO_CREAR_PROPIO', 'Presentar descargos propios'),
    ('EXPEDIENTE_CERRAR', 'Cerrar expediente'),
    ('CONFIGURACION_GESTIONAR', 'Administrar correo, plantillas, parametros y catalogos'),
    ('AUDITORIA_VER', 'Consultar auditoria, eventos de seguridad y sesiones'),
    ('CHATBOT_GESTIONAR', 'Crear, editar y publicar base de conocimiento del chatbot')
) AS semilla(Codigo, Nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos p WHERE p.Codigo = semilla.Codigo);
GO

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r CROSS JOIN dbo.Permisos p
WHERE
    (
      (r.Codigo = 'BECADO' AND p.Codigo IN ('APELACION_CREAR_PROPIA','DESCARGO_CREAR_PROPIO')) OR
      (r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN ('APELACION_LISTAR','APELACION_ASIGNAR','APELACION_RESOLVER','DISCIPLINARIO_GESTIONAR',
          'EXPEDIENTE_CERRAR','CHATBOT_GESTIONAR')) OR
      (r.Codigo = 'COORDINADOR_BECAS' AND p.Codigo IN ('APELACION_LISTAR','AUDITORIA_VER')) OR
      (r.Codigo = 'ADMINISTRADOR' AND p.Codigo IN ('APELACION_CREAR_PROPIA','APELACION_LISTAR','APELACION_ASIGNAR','APELACION_RESOLVER',
          'DISCIPLINARIO_GESTIONAR','DESCARGO_CREAR_PROPIO','EXPEDIENTE_CERRAR','CONFIGURACION_GESTIONAR','AUDITORIA_VER','CHATBOT_GESTIONAR'))
    )
AND NOT EXISTS (
    SELECT 1 FROM dbo.RolesPermisos rp
    WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'APELACION_PLAZO_DIAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato)
    VALUES ('APELACION_PLAZO_DIAS', '10', 'Dias habiles para presentar una apelacion desde la resolucion', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'SUSPENSION_PLAZO_DESCARGOS_DIAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato)
    VALUES ('SUSPENSION_PLAZO_DESCARGOS_DIAS', '8', 'Dias habiles para presentar descargos desde la notificacion de investigacion', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'CHATBOT_MAXIMO_RESULTADOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato)
    VALUES ('CHATBOT_MAXIMO_RESULTADOS', '3', 'Cantidad maxima de respuestas que devuelve el chatbot publico', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'CORREO_REMITENTE_NOMBRE')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato)
    VALUES ('CORREO_REMITENTE_NOMBRE', 'SGBE CUC', 'Nombre visible del remitente en los correos salientes', 'TEXTO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'NOTIFICACION_REINTENTOS_MAXIMOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato)
    VALUES ('NOTIFICACION_REINTENTOS_MAXIMOS', '3', 'Reintentos maximos de envio de correo antes de marcarlo como fallido definitivo', 'NUMERO');
GO

INSERT INTO dbo.PlantillasMensajes (Codigo, Asunto, Contenido)
SELECT v.Codigo, v.Asunto, v.Contenido
FROM (VALUES
    ('APELACION_RESUELTA', N'Resultado de su apelacion', N'<p>Su apelacion fue resuelta <strong>{{resultado}}</strong>.</p><p>{{motivo}}</p>'),
    ('INVESTIGACION_ABIERTA', N'Se abrio un proceso de revision sobre su beca', N'<p>Causal: {{causal}}.</p><p>Tiene {{plazoDias}} dias habiles para presentar sus descargos.</p>'),
    ('INVESTIGACION_RESUELTA', N'Se resolvio el proceso de revision de su beca', N'<p>Resultado: {{resultado}}.</p><p>{{motivo}}</p>')
) v(Codigo, Asunto, Contenido)
WHERE NOT EXISTS (SELECT 1 FROM dbo.PlantillasMensajes p WHERE p.Codigo = v.Codigo);
GO
