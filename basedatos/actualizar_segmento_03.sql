-- =====================================================================
-- Sistema de Gestion de Becas Estudiantiles (SGBE) - CUC
-- Script de actualizacion - Segmento 03
-- Motor: SQL Server
--
-- Este script se ejecuta DESPUES de crear_base_datos.sql (que ya crea
-- todas las tablas del Segmento 03 en su seccion 7 y 8). Aqui solo se
-- ajustan reglas de estado que el Segmento 03 necesita y que no
-- estaban activas todavia (no habia codigo usandolas), y se agregan
-- los permisos, roles y parametros nuevos.
--
-- Reglas seguidas: sin vistas, sin triggers, sin cursores, sin SQL
-- dinamico, sin procedimientos almacenados. Puede ejecutarse mas de
-- una vez de forma segura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estados de Apelaciones
-- El script original dejo Estado con 3 valores provisionales
-- (PRESENTADA, EN_REVISION, RESUELTA). El Segmento 03 exige los 5
-- estados de la seccion 7.1 de PROMPT_CLAUDE_SEGMENTO_03.md. Como
-- todavia no existia codigo usando la restriccion anterior, se
-- desactivan las restricciones viejas de la tabla (NOCHECK, sin
-- necesidad de conocer su nombre autogenerado) y se agrega una nueva
-- restriccion con nombre explicito.
-- ---------------------------------------------------------------------
ALTER TABLE dbo.Apelaciones NOCHECK CONSTRAINT ALL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Apelaciones_Estado_Seg03')
BEGIN
    ALTER TABLE dbo.Apelaciones
        ADD CONSTRAINT CK_Apelaciones_Estado_Seg03
        CHECK (Estado IN ('RECIBIDA','EN_REVISION','RESUELTA_A_FAVOR','RESUELTA_EN_CONTRA','RECHAZADA_POR_PLAZO'));
END
GO

-- ---------------------------------------------------------------------
-- 2. Estados de InvestigacionesBeca
-- Mismo caso: se amplia de 3 a los 5 estados minimos de la seccion 7.2.
-- ---------------------------------------------------------------------
ALTER TABLE dbo.InvestigacionesBeca NOCHECK CONSTRAINT ALL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Investigaciones_Estado_Seg03')
BEGIN
    ALTER TABLE dbo.InvestigacionesBeca
        ADD CONSTRAINT CK_Investigaciones_Estado_Seg03
        CHECK (Estado IN ('ABIERTA','EN_DESCARGOS','EN_ANALISIS','RESUELTA','CERRADA'));
END
GO

-- Nota de supuesto: dbo.ResolucionesSuspension.Resultado se conserva con
-- los valores originales (SUSPENDIDA, CANCELADA, SIN_MERITO) porque ya
-- expresan exactamente MANTENER = SIN_MERITO, SUSPENDER = SUSPENDIDA,
-- CANCELAR = CANCELADA. La API traduce estos valores en las dos
-- direcciones para no duplicar significado.

-- ---------------------------------------------------------------------
-- 2.1 Columna adicional en EnviosCorreo para poder reintentar un envio
-- fallido sin volver a generar el contenido (F34).
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.EnviosCorreo') AND name = 'ContenidoHtml')
    ALTER TABLE dbo.EnviosCorreo ADD ContenidoHtml NVARCHAR(MAX) NULL;
GO

-- ---------------------------------------------------------------------
-- 3. Nuevos parametros de sistema (no sensibles)
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'APELACION_PLAZO_DIAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('APELACION_PLAZO_DIAS', '10', 'Dias habiles para presentar una apelacion desde la resolucion', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'SUSPENSION_PLAZO_DESCARGOS_DIAS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('SUSPENSION_PLAZO_DESCARGOS_DIAS', '8', 'Dias habiles para presentar descargos desde la notificacion de investigacion', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'CHATBOT_MAXIMO_RESULTADOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('CHATBOT_MAXIMO_RESULTADOS', '3', 'Cantidad maxima de respuestas que devuelve el chatbot publico', 'NUMERO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'CORREO_REMITENTE_NOMBRE')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('CORREO_REMITENTE_NOMBRE', 'SGBE CUC', 'Nombre visible del remitente en los correos salientes', 'TEXTO');
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionesSistema WHERE Clave = 'NOTIFICACION_REINTENTOS_MAXIMOS')
    INSERT INTO dbo.ConfiguracionesSistema (Clave, Valor, Descripcion, TipoDato) VALUES ('NOTIFICACION_REINTENTOS_MAXIMOS', '3', 'Reintentos maximos de envio de correo antes de marcarlo como fallido definitivo', 'NUMERO');
GO

-- ---------------------------------------------------------------------
-- 4. Nuevos permisos del Segmento 03
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'APELACION_CREAR_PROPIA')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('APELACION_CREAR_PROPIA', 'Presentar apelacion propia');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'APELACION_LISTAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('APELACION_LISTAR', 'Listar y ver apelaciones');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'APELACION_ASIGNAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('APELACION_ASIGNAR', 'Asignar revisor de apelacion');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'APELACION_RESOLVER')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('APELACION_RESOLVER', 'Resolver apelacion');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'DISCIPLINARIO_GESTIONAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('DISCIPLINARIO_GESTIONAR', 'Abrir y resolver procesos disciplinarios (suspension/cancelacion)');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'DESCARGO_CREAR_PROPIO')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('DESCARGO_CREAR_PROPIO', 'Presentar descargos propios');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'EXPEDIENTE_CERRAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('EXPEDIENTE_CERRAR', 'Cerrar expediente');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'CONFIGURACION_GESTIONAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('CONFIGURACION_GESTIONAR', 'Administrar correo, plantillas, parametros y catalogos');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'AUDITORIA_VER')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('AUDITORIA_VER', 'Consultar auditoria, eventos de seguridad y sesiones');
IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'CHATBOT_GESTIONAR')
    INSERT INTO dbo.Permisos (Codigo, Nombre) VALUES ('CHATBOT_GESTIONAR', 'Crear, editar y publicar base de conocimiento del chatbot');
GO

-- ---------------------------------------------------------------------
-- 5. Asignacion de permisos nuevos a roles existentes
-- Se agrega fila por fila (evitando duplicados) en vez de repetir el
-- bloque original completo, que solo corria una vez sobre tabla vacia.
-- ---------------------------------------------------------------------
INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r, dbo.Permisos p
WHERE r.Codigo = 'BECADO' AND p.Codigo IN ('APELACION_CREAR_PROPIA', 'DESCARGO_CREAR_PROPIO')
  AND NOT EXISTS (SELECT 1 FROM dbo.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r, dbo.Permisos p
WHERE r.Codigo = 'TRABAJADORA_SOCIAL' AND p.Codigo IN
    ('APELACION_LISTAR','APELACION_ASIGNAR','APELACION_RESOLVER','DISCIPLINARIO_GESTIONAR',
     'EXPEDIENTE_CERRAR','CHATBOT_GESTIONAR')
  AND NOT EXISTS (SELECT 1 FROM dbo.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r, dbo.Permisos p
WHERE r.Codigo = 'COORDINADOR_BECAS' AND p.Codigo IN ('APELACION_LISTAR', 'AUDITORIA_VER')
  AND NOT EXISTS (SELECT 1 FROM dbo.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);

INSERT INTO dbo.RolesPermisos (IdRol, IdPermiso)
SELECT r.IdRol, p.IdPermiso
FROM dbo.Roles r, dbo.Permisos p
WHERE r.Codigo = 'ADMINISTRADOR'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolesPermisos rp WHERE rp.IdRol = r.IdRol AND rp.IdPermiso = p.IdPermiso);
GO

-- ---------------------------------------------------------------------
-- 6. Plantillas de correo minimas del Segmento 03
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.PlantillasMensajes WHERE Codigo = 'APELACION_RESUELTA')
    INSERT INTO dbo.PlantillasMensajes (Codigo, Asunto, Contenido) VALUES
    ('APELACION_RESUELTA', 'Resultado de su apelación',
     '<p>Su apelación fue resuelta <strong>{{resultado}}</strong>.</p><p>{{motivo}}</p>');

IF NOT EXISTS (SELECT 1 FROM dbo.PlantillasMensajes WHERE Codigo = 'INVESTIGACION_ABIERTA')
    INSERT INTO dbo.PlantillasMensajes (Codigo, Asunto, Contenido) VALUES
    ('INVESTIGACION_ABIERTA', 'Se abrió un proceso de revisión sobre su beca',
     '<p>Causal: {{causal}}.</p><p>Tiene {{plazoDias}} días hábiles para presentar sus descargos.</p>');

IF NOT EXISTS (SELECT 1 FROM dbo.PlantillasMensajes WHERE Codigo = 'INVESTIGACION_RESUELTA')
    INSERT INTO dbo.PlantillasMensajes (Codigo, Asunto, Contenido) VALUES
    ('INVESTIGACION_RESUELTA', 'Se resolvió el proceso de revisión de su beca',
     '<p>Resultado: {{resultado}}.</p><p>{{motivo}}</p>');
GO

-- ---------------------------------------------------------------------
-- 7. Preguntas frecuentes minimas del chatbot
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.PreguntasRespuestasChatbot WHERE Pregunta = '¿Cómo apelo una resolución de beca?')
    INSERT INTO dbo.PreguntasRespuestasChatbot (Pregunta, Respuesta, Categoria, PalabrasClave) VALUES
    ('¿Cómo apelo una resolución de beca?',
     'Ingrese a su expediente, ubique la resolución y presione "Apelar". Tiene un plazo de días hábiles desde la notificación para hacerlo.',
     'Apelaciones', 'apelar,apelacion,resolucion,inconforme');

IF NOT EXISTS (SELECT 1 FROM dbo.PreguntasRespuestasChatbot WHERE Pregunta = '¿Qué pasa si me suspenden la beca?')
    INSERT INTO dbo.PreguntasRespuestasChatbot (Pregunta, Respuesta, Categoria, PalabrasClave) VALUES
    ('¿Qué pasa si me suspenden la beca?',
     'Recibirá una notificación con la causal y podrá presentar descargos dentro del plazo indicado antes de que se resuelva el caso.',
     'Suspensión', 'suspension,suspendida,descargos,investigacion');
GO

PRINT 'Script de actualizacion del Segmento 03 ejecutado correctamente.';
GO
