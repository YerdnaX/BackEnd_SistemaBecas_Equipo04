-- =====================================================================
-- Sistema de Gestion de Becas Estudiantiles (SGBE) - CUC
-- Datos de prueba del Segmento 01
--
-- USO EXCLUSIVO EN AMBIENTES DE DESARROLLO / PRUEBAS. NO ejecutar en
-- produccion: crea cuentas con una contrasena conocida y publica.
--
-- Requisito previo: haber ejecutado BackEnd/basedatos/crear_base_datos.sql
-- (crea tablas, roles, permisos, tipos de documento y componentes de
-- evaluacion). Este script solo agrega filas; no crea tablas.
--
-- Idempotente: cada bloque valida con IF NOT EXISTS antes de insertar,
-- por lo que puede ejecutarse varias veces sin duplicar datos.
--
-- Cuentas de prueba creadas (todas con la misma contrasena):
--   Correo                              Rol                    Contrasena
--   admin.pruebas@cuc.ac.cr             ADMINISTRADOR          Prueba2026!
--   coordinador.pruebas@cuc.ac.cr       COORDINADOR_BECAS      Prueba2026!
--   trabajosocial.pruebas@cuc.ac.cr     TRABAJADORA_SOCIAL     Prueba2026!
--   comite.pruebas@cuc.ac.cr            COMITE_BECAS           Prueba2026!
--   aspirante1.pruebas@cuc.ac.cr        ASPIRANTE (borrador)   Prueba2026!
--   aspirante2.pruebas@cuc.ac.cr        ASPIRANTE (en revision)Prueba2026!
--   aspirante3.pruebas@cuc.ac.cr        ASPIRANTE (en comite)  Prueba2026!
--   aspirante4.pruebas@cuc.ac.cr        ASPIRANTE (aprobada)   Prueba2026!
--
-- El hash de contrasena fue generado con bcryptjs (10 rondas), igual que
-- el backend real; no es texto plano.
-- =====================================================================

SET NOCOUNT ON;

IF DB_ID(N'SGBE_CUC') IS NOT NULL
BEGIN
    USE SGBE_CUC;
END
GO

DECLARE @HashPrueba NVARCHAR(255) = N'$2a$10$IX.7Ij3W20RMJqYKhDULXuucaBs464rdWo1R9ujbwXWyelinsL7gG'; -- Prueba2026!

-- =====================================================================
-- 1. USUARIOS DE PRUEBA Y ROLES
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'admin.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'admin.pruebas@cuc.ac.cr', @HashPrueba, N'Andrea', N'Vargas', N'Solano', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'coordinador.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'coordinador.pruebas@cuc.ac.cr', @HashPrueba, N'Luis', N'Chacón', N'Mora', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'trabajosocial.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'trabajosocial.pruebas@cuc.ac.cr', @HashPrueba, N'Karla', N'Jiménez', N'Rojas', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'comite.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'comite.pruebas@cuc.ac.cr', @HashPrueba, N'Rodrigo', N'Salas', N'Fernández', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'aspirante1.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'aspirante1.pruebas@cuc.ac.cr', @HashPrueba, N'Elena', N'Rodríguez', N'Mata', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'aspirante2.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'aspirante2.pruebas@cuc.ac.cr', @HashPrueba, N'Andrés', N'Solano', N'Quesada', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'aspirante3.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'aspirante3.pruebas@cuc.ac.cr', @HashPrueba, N'Fabiola', N'Araya', N'Brenes', 'ACTIVO', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'aspirante4.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, SegundoApellido, Estado, CorreoVerificado)
    VALUES (N'aspirante4.pruebas@cuc.ac.cr', @HashPrueba, N'Josué', N'Méndez', N'Castro', 'ACTIVO', 1);
GO

-- Asignacion de roles (idempotente: NOT EXISTS evita duplicados en UsuariosRoles)
INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol)
SELECT u.IdUsuario, r.IdRol
FROM (VALUES
    (N'admin.pruebas@cuc.ac.cr', N'ADMINISTRADOR'),
    (N'coordinador.pruebas@cuc.ac.cr', N'COORDINADOR_BECAS'),
    (N'trabajosocial.pruebas@cuc.ac.cr', N'TRABAJADORA_SOCIAL'),
    (N'comite.pruebas@cuc.ac.cr', N'COMITE_BECAS'),
    (N'aspirante1.pruebas@cuc.ac.cr', N'ASPIRANTE'),
    (N'aspirante2.pruebas@cuc.ac.cr', N'ASPIRANTE'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'ASPIRANTE'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'ASPIRANTE')
) AS datos(Correo, CodigoRol)
JOIN dbo.Usuarios u ON u.Correo = datos.Correo
JOIN dbo.Roles r ON r.Codigo = datos.CodigoRol
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.UsuariosRoles ur WHERE ur.IdUsuario = u.IdUsuario AND ur.IdRol = r.IdRol
);
GO

-- =====================================================================
-- 2. EMPLEADOS (personal de trabajo social vinculado a su usuario)
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Empleados e JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuario WHERE u.Correo = N'trabajosocial.pruebas@cuc.ac.cr')
    INSERT INTO dbo.Empleados (IdUsuario, NumeroEmpleado, Puesto, Departamento)
    SELECT IdUsuario, N'EMP-PRUEBA-001', N'Trabajadora Social', N'Bienestar Estudiantil'
    FROM dbo.Usuarios WHERE Correo = N'trabajosocial.pruebas@cuc.ac.cr';
GO

-- =====================================================================
-- 3. TIPOS DE BECA, RUBROS Y CRITERIOS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.TiposBeca WHERE Nombre = N'Beca Socioeconómica')
    INSERT INTO dbo.TiposBeca (Nombre, Descripcion, PorcentajeCobertura)
    VALUES (N'Beca Socioeconómica', N'Beca dirigida a estudiantes en condición socioeconómica vulnerable.', 80.00);

IF NOT EXISTS (SELECT 1 FROM dbo.TiposBeca WHERE Nombre = N'Beca de Excelencia Académica')
    INSERT INTO dbo.TiposBeca (Nombre, Descripcion, PorcentajeCobertura)
    VALUES (N'Beca de Excelencia Académica', N'Beca para estudiantes con alto rendimiento académico.', 100.00);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.RubrosCobertura r JOIN dbo.TiposBeca t ON t.IdTipoBeca = r.IdTipoBeca WHERE t.Nombre = N'Beca Socioeconómica' AND r.Nombre = N'Matrícula')
    INSERT INTO dbo.RubrosCobertura (IdTipoBeca, Nombre, Descripcion, Porcentaje)
    SELECT IdTipoBeca, N'Matrícula', N'Cobertura de matrícula del periodo', 60.00 FROM dbo.TiposBeca WHERE Nombre = N'Beca Socioeconómica';

IF NOT EXISTS (SELECT 1 FROM dbo.RubrosCobertura r JOIN dbo.TiposBeca t ON t.IdTipoBeca = r.IdTipoBeca WHERE t.Nombre = N'Beca Socioeconómica' AND r.Nombre = N'Materiales')
    INSERT INTO dbo.RubrosCobertura (IdTipoBeca, Nombre, Descripcion, Porcentaje)
    SELECT IdTipoBeca, N'Materiales', N'Materiales y útiles académicos', 20.00 FROM dbo.TiposBeca WHERE Nombre = N'Beca Socioeconómica';

IF NOT EXISTS (SELECT 1 FROM dbo.RubrosCobertura r JOIN dbo.TiposBeca t ON t.IdTipoBeca = r.IdTipoBeca WHERE t.Nombre = N'Beca de Excelencia Académica' AND r.Nombre = N'Matrícula')
    INSERT INTO dbo.RubrosCobertura (IdTipoBeca, Nombre, Descripcion, Porcentaje)
    SELECT IdTipoBeca, N'Matrícula', N'Cobertura total de matrícula', 100.00 FROM dbo.TiposBeca WHERE Nombre = N'Beca de Excelencia Académica';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CriteriosElegibilidad c JOIN dbo.TiposBeca t ON t.IdTipoBeca = c.IdTipoBeca WHERE t.Nombre = N'Beca Socioeconómica' AND c.Nombre = N'Ingreso familiar per cápita bajo el promedio')
    INSERT INTO dbo.CriteriosElegibilidad (IdTipoBeca, Nombre, Descripcion, Obligatorio)
    SELECT IdTipoBeca, N'Ingreso familiar per cápita bajo el promedio', NULL, 1 FROM dbo.TiposBeca WHERE Nombre = N'Beca Socioeconómica';

IF NOT EXISTS (SELECT 1 FROM dbo.CriteriosElegibilidad c JOIN dbo.TiposBeca t ON t.IdTipoBeca = c.IdTipoBeca WHERE t.Nombre = N'Beca de Excelencia Académica' AND c.Nombre = N'Promedio igual o mayor a 90')
    INSERT INTO dbo.CriteriosElegibilidad (IdTipoBeca, Nombre, Descripcion, Obligatorio)
    SELECT IdTipoBeca, N'Promedio igual o mayor a 90', NULL, 1 FROM dbo.TiposBeca WHERE Nombre = N'Beca de Excelencia Académica';
GO

-- =====================================================================
-- 4. CONVOCATORIAS, REQUISITOS Y ETAPAS
-- =====================================================================

-- Convocatoria 1: PUBLICADA y vigente, con recepción ABIERTA (lista para postular)
IF NOT EXISTS (SELECT 1 FROM dbo.Convocatorias WHERE Nombre = N'Convocatoria Ordinaria de Prueba 2026-I')
    INSERT INTO dbo.Convocatorias (IdTipoBeca, Nombre, Descripcion, FechaInicio, FechaFin, Cupos, Presupuesto, Estado, IdCreadoPor, IdAprobadoPor, FechaPublicacion)
    SELECT tb.IdTipoBeca, N'Convocatoria Ordinaria de Prueba 2026-I',
        N'Convocatoria de datos de prueba, publicada y vigente para postular de inmediato.',
        DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, 60, SYSUTCDATETIME()),
        15, 5000000.00, 'PUBLICADA', u.IdUsuario, u.IdUsuario, DATEADD(DAY, -5, SYSUTCDATETIME())
    FROM dbo.TiposBeca tb, dbo.Usuarios u
    WHERE tb.Nombre = N'Beca Socioeconómica' AND u.Correo = N'admin.pruebas@cuc.ac.cr';

-- Convocatoria 2: BORRADOR, para practicar el flujo de aprobación y publicación
IF NOT EXISTS (SELECT 1 FROM dbo.Convocatorias WHERE Nombre = N'Convocatoria Excelencia de Prueba 2026-I')
    INSERT INTO dbo.Convocatorias (IdTipoBeca, Nombre, Descripcion, FechaInicio, FechaFin, Cupos, Presupuesto, Estado, IdCreadoPor)
    SELECT tb.IdTipoBeca, N'Convocatoria Excelencia de Prueba 2026-I',
        N'Convocatoria de datos de prueba en borrador, para practicar el flujo de aprobación y publicación.',
        DATEADD(DAY, 5, SYSUTCDATETIME()), DATEADD(DAY, 90, SYSUTCDATETIME()),
        10, 3000000.00, 'BORRADOR', u.IdUsuario
    FROM dbo.TiposBeca tb, dbo.Usuarios u
    WHERE tb.Nombre = N'Beca de Excelencia Académica' AND u.Correo = N'admin.pruebas@cuc.ac.cr';
GO

-- Requisitos de la convocatoria 1
IF NOT EXISTS (SELECT 1 FROM dbo.RequisitosConvocatoria r JOIN dbo.Convocatorias c ON c.IdConvocatoria = r.IdConvocatoria WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND r.Nombre = N'Identificación')
    INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
    SELECT c.IdConvocatoria, N'Identificación', N'Cédula o documento de identidad vigente', td.IdTipoDocumento, 1
    FROM dbo.Convocatorias c, dbo.TiposDocumento td
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND td.Codigo = N'IDENTIFICACION';

IF NOT EXISTS (SELECT 1 FROM dbo.RequisitosConvocatoria r JOIN dbo.Convocatorias c ON c.IdConvocatoria = r.IdConvocatoria WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND r.Nombre = N'Constancia salarial')
    INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
    SELECT c.IdConvocatoria, N'Constancia salarial', N'Constancia de ingresos del hogar', td.IdTipoDocumento, 1
    FROM dbo.Convocatorias c, dbo.TiposDocumento td
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND td.Codigo = N'CONSTANCIA_SALARIAL';

IF NOT EXISTS (SELECT 1 FROM dbo.RequisitosConvocatoria r JOIN dbo.Convocatorias c ON c.IdConvocatoria = r.IdConvocatoria WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND r.Nombre = N'Historial académico')
    INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
    SELECT c.IdConvocatoria, N'Historial académico', N'Historial o informe de calificaciones', td.IdTipoDocumento, 1
    FROM dbo.Convocatorias c, dbo.TiposDocumento td
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND td.Codigo = N'HISTORIAL_ACADEMICO';

-- Requisitos de la convocatoria 2 (para que pueda publicarse al practicar el flujo)
IF NOT EXISTS (SELECT 1 FROM dbo.RequisitosConvocatoria r JOIN dbo.Convocatorias c ON c.IdConvocatoria = r.IdConvocatoria WHERE c.Nombre = N'Convocatoria Excelencia de Prueba 2026-I' AND r.Nombre = N'Identificación')
    INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
    SELECT c.IdConvocatoria, N'Identificación', N'Cédula o documento de identidad vigente', td.IdTipoDocumento, 1
    FROM dbo.Convocatorias c, dbo.TiposDocumento td
    WHERE c.Nombre = N'Convocatoria Excelencia de Prueba 2026-I' AND td.Codigo = N'IDENTIFICACION';

IF NOT EXISTS (SELECT 1 FROM dbo.RequisitosConvocatoria r JOIN dbo.Convocatorias c ON c.IdConvocatoria = r.IdConvocatoria WHERE c.Nombre = N'Convocatoria Excelencia de Prueba 2026-I' AND r.Nombre = N'Historial académico')
    INSERT INTO dbo.RequisitosConvocatoria (IdConvocatoria, Nombre, Descripcion, IdTipoDocumento, Obligatorio)
    SELECT c.IdConvocatoria, N'Historial académico', N'Historial o informe de calificaciones', td.IdTipoDocumento, 1
    FROM dbo.Convocatorias c, dbo.TiposDocumento td
    WHERE c.Nombre = N'Convocatoria Excelencia de Prueba 2026-I' AND td.Codigo = N'HISTORIAL_ACADEMICO';
GO

-- Etapas (las 5 por convocatoria; RECEPCION queda ABIERTA en la convocatoria 1)
INSERT INTO dbo.EtapasConvocatoria (IdConvocatoria, TipoEtapa, FechaInicio, FechaFin, Estado)
SELECT c.IdConvocatoria, tipos.TipoEtapa, c.FechaInicio, c.FechaFin,
    CASE WHEN tipos.TipoEtapa = 'RECEPCION' AND c.Estado = 'PUBLICADA' THEN 'ABIERTA' ELSE 'PROGRAMADA' END
FROM dbo.Convocatorias c
CROSS JOIN (VALUES ('RECEPCION'), ('REVISION_DOCUMENTAL'), ('EVALUACION'), ('COMITE'), ('RESULTADOS')) AS tipos(TipoEtapa)
WHERE c.Nombre IN (N'Convocatoria Ordinaria de Prueba 2026-I', N'Convocatoria Excelencia de Prueba 2026-I')
AND NOT EXISTS (
    SELECT 1 FROM dbo.EtapasConvocatoria e WHERE e.IdConvocatoria = c.IdConvocatoria AND e.TipoEtapa = tipos.TipoEtapa
);
GO

-- =====================================================================
-- 5. SOLICITUDES EN DISTINTOS ESTADOS (una por aspirante de prueba)
-- =====================================================================

-- Aspirante 1: solicitud en BORRADOR, parcialmente completa (falta socioeconómico y documentos)
IF NOT EXISTS (
    SELECT 1 FROM dbo.Solicitudes s JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    WHERE u.Correo = N'aspirante1.pruebas@cuc.ac.cr'
)
    INSERT INTO dbo.Solicitudes (IdConvocatoria, IdUsuario, Estado, Progreso)
    SELECT c.IdConvocatoria, u.IdUsuario, 'BORRADOR', 50
    FROM dbo.Convocatorias c, dbo.Usuarios u
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND u.Correo = N'aspirante1.pruebas@cuc.ac.cr';

-- Aspirante 2: solicitud ENVIADA, expediente EN_REVISION_DOCUMENTAL
IF NOT EXISTS (
    SELECT 1 FROM dbo.Solicitudes s JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    WHERE u.Correo = N'aspirante2.pruebas@cuc.ac.cr'
)
    INSERT INTO dbo.Solicitudes (IdConvocatoria, IdUsuario, Estado, Progreso, FechaEnvio)
    SELECT c.IdConvocatoria, u.IdUsuario, 'EN_REVISION_DOCUMENTAL', 100, DATEADD(DAY, -3, SYSUTCDATETIME())
    FROM dbo.Convocatorias c, dbo.Usuarios u
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND u.Correo = N'aspirante2.pruebas@cuc.ac.cr';

-- Aspirante 3: solicitud elegible, evaluada y enviada al comité (EN_COMITE)
IF NOT EXISTS (
    SELECT 1 FROM dbo.Solicitudes s JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    WHERE u.Correo = N'aspirante3.pruebas@cuc.ac.cr'
)
    INSERT INTO dbo.Solicitudes (IdConvocatoria, IdUsuario, Estado, Progreso, FechaEnvio)
    SELECT c.IdConvocatoria, u.IdUsuario, 'EN_COMITE', 100, DATEADD(DAY, -7, SYSUTCDATETIME())
    FROM dbo.Convocatorias c, dbo.Usuarios u
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND u.Correo = N'aspirante3.pruebas@cuc.ac.cr';

-- Aspirante 4: solicitud ya resuelta y APROBADA por el comité
IF NOT EXISTS (
    SELECT 1 FROM dbo.Solicitudes s JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
    WHERE u.Correo = N'aspirante4.pruebas@cuc.ac.cr'
)
    INSERT INTO dbo.Solicitudes (IdConvocatoria, IdUsuario, Estado, Progreso, FechaEnvio)
    SELECT c.IdConvocatoria, u.IdUsuario, 'APROBADA', 100, DATEADD(DAY, -14, SYSUTCDATETIME())
    FROM dbo.Convocatorias c, dbo.Usuarios u
    WHERE c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I' AND u.Correo = N'aspirante4.pruebas@cuc.ac.cr';
GO

-- Datos personales, académicos y socioeconómicos por solicitud
INSERT INTO dbo.DatosPersonalesSolicitud (IdSolicitud, Identificacion, FechaNacimiento, Telefono, Direccion, ContactoEmergencia, TelefonoEmergencia)
SELECT s.IdSolicitud, datos.Identificacion, datos.FechaNacimiento, datos.Telefono, datos.Direccion, datos.ContactoEmergencia, datos.TelefonoEmergencia
FROM dbo.Solicitudes s
JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
CROSS APPLY (VALUES
    (N'aspirante1.pruebas@cuc.ac.cr', N'1-1111-1111', '2004-02-10', N'8888-1111', N'Cartago, San Nicolás', N'María Rodríguez', N'8888-1112'),
    (N'aspirante2.pruebas@cuc.ac.cr', N'1-2222-2222', '2003-06-21', N'8888-2222', N'Cartago, Tres Ríos', N'Carmen Solano', N'8888-2223'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'1-3333-3333', '2002-11-05', N'8888-3333', N'Cartago, Paraíso', N'Jorge Araya', N'8888-3334'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'1-4444-4444', '2003-01-30', N'8888-4444', N'Cartago, Oriente', N'Rosa Castro', N'8888-4445')
) AS datos(Correo, Identificacion, FechaNacimiento, Telefono, Direccion, ContactoEmergencia, TelefonoEmergencia)
WHERE u.Correo = datos.Correo
AND NOT EXISTS (SELECT 1 FROM dbo.DatosPersonalesSolicitud dp WHERE dp.IdSolicitud = s.IdSolicitud);

INSERT INTO dbo.DatosAcademicosSolicitud (IdSolicitud, NumeroEstudiante, Carrera, NivelAcademico, Promedio, CreditosMatriculados, CondicionAcademica)
SELECT s.IdSolicitud, datos.NumeroEstudiante, datos.Carrera, datos.NivelAcademico, datos.Promedio, datos.CreditosMatriculados, datos.CondicionAcademica
FROM dbo.Solicitudes s
JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
CROSS APPLY (VALUES
    (N'aspirante1.pruebas@cuc.ac.cr', N'2024010001', N'Ingeniería en Sistemas', N'Segundo año', 78.50, 16, N'Regular'),
    (N'aspirante2.pruebas@cuc.ac.cr', N'2023020002', N'Contaduría Pública', N'Tercer año', 82.00, 18, N'Regular'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'2022030003', N'Ingeniería Industrial', N'Cuarto año', 88.75, 17, N'Regular'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'2022040004', N'Administración de Empresas', N'Cuarto año', 91.20, 15, N'Regular')
) AS datos(Correo, NumeroEstudiante, Carrera, NivelAcademico, Promedio, CreditosMatriculados, CondicionAcademica)
WHERE u.Correo = datos.Correo
AND NOT EXISTS (SELECT 1 FROM dbo.DatosAcademicosSolicitud da WHERE da.IdSolicitud = s.IdSolicitud);

INSERT INTO dbo.DatosSocioeconomicosSolicitud (IdSolicitud, TipoVivienda, CantidadIntegrantes, IngresoMensual, GastoMensual, SituacionLaboral, Observaciones)
SELECT s.IdSolicitud, datos.TipoVivienda, datos.CantidadIntegrantes, datos.IngresoMensual, datos.GastoMensual, datos.SituacionLaboral, datos.Observaciones
FROM dbo.Solicitudes s
JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
CROSS APPLY (VALUES
    -- aspirante1 (BORRADOR) queda sin datos socioeconómicos a propósito, para probar el estado "incompleto"
    (N'aspirante2.pruebas@cuc.ac.cr', N'Alquilada', 4, 380000.00, 320000.00, N'Desempleado', N''),
    (N'aspirante3.pruebas@cuc.ac.cr', N'Propia', 3, 450000.00, 300000.00, N'Empleo parcial', N''),
    (N'aspirante4.pruebas@cuc.ac.cr', N'Propia', 5, 520000.00, 400000.00, N'Empleo completo', N'')
) AS datos(Correo, TipoVivienda, CantidadIntegrantes, IngresoMensual, GastoMensual, SituacionLaboral, Observaciones)
WHERE u.Correo = datos.Correo
AND NOT EXISTS (SELECT 1 FROM dbo.DatosSocioeconomicosSolicitud ds WHERE ds.IdSolicitud = s.IdSolicitud);
GO

-- Un integrante del grupo familiar por cada solicitud con datos socioeconómicos
INSERT INTO dbo.MiembrosGrupoFamiliar (IdDatosSocioeconomicos, Nombre, Parentesco, Edad, Ocupacion, IngresoMensual, DependeEconomicamente)
SELECT ds.IdDatosSocioeconomicos, N'Familiar de referencia', N'Madre/Padre', 48, N'Comerciante', ds.IngresoMensual, 0
FROM dbo.DatosSocioeconomicosSolicitud ds
WHERE NOT EXISTS (SELECT 1 FROM dbo.MiembrosGrupoFamiliar m WHERE m.IdDatosSocioeconomicos = ds.IdDatosSocioeconomicos);
GO

-- =====================================================================
-- 6. ARCHIVOS Y DOCUMENTOS (para aspirantes 2, 3 y 4)
-- =====================================================================

-- Aspirante 2: Identificación y Constancia salarial válidos, Historial académico pendiente de revisión
INSERT INTO dbo.Archivos (NombreOriginal, NombreInterno, TipoMime, Extension, TamanoBytes, Contenido)
SELECT datos.NombreOriginal, datos.NombreInterno, N'application/pdf', 'pdf',
    DATALENGTH(CONVERT(VARBINARY(MAX), datos.Contenido)), CONVERT(VARBINARY(MAX), datos.Contenido)
FROM (VALUES
    (N'identificacion-aspirante2.pdf', N'prueba-a2-identificacion.pdf', N'Documento de prueba: identificación de aspirante2.'),
    (N'constancia-salarial-aspirante2.pdf', N'prueba-a2-constancia.pdf', N'Documento de prueba: constancia salarial de aspirante2.'),
    (N'historial-academico-aspirante2.pdf', N'prueba-a2-historial.pdf', N'Documento de prueba: historial académico de aspirante2.'),
    (N'identificacion-aspirante3.pdf', N'prueba-a3-identificacion.pdf', N'Documento de prueba: identificación de aspirante3.'),
    (N'constancia-salarial-aspirante3.pdf', N'prueba-a3-constancia.pdf', N'Documento de prueba: constancia salarial de aspirante3.'),
    (N'historial-academico-aspirante3.pdf', N'prueba-a3-historial.pdf', N'Documento de prueba: historial académico de aspirante3.'),
    (N'identificacion-aspirante4.pdf', N'prueba-a4-identificacion.pdf', N'Documento de prueba: identificación de aspirante4.'),
    (N'constancia-salarial-aspirante4.pdf', N'prueba-a4-constancia.pdf', N'Documento de prueba: constancia salarial de aspirante4.'),
    (N'historial-academico-aspirante4.pdf', N'prueba-a4-historial.pdf', N'Documento de prueba: historial académico de aspirante4.')
) AS datos(NombreOriginal, NombreInterno, Contenido)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Archivos a WHERE a.NombreInterno = datos.NombreInterno);
GO

-- DocumentosSolicitud: vincula cada Archivo con su Solicitud y Requisito
INSERT INTO dbo.DocumentosSolicitud (IdSolicitud, IdRequisito, IdTipoDocumento, IdArchivo, Estado)
SELECT s.IdSolicitud, req.IdRequisito, req.IdTipoDocumento, a.IdArchivo, datos.Estado
FROM (VALUES
    (N'aspirante2.pruebas@cuc.ac.cr', N'Identificación', N'prueba-a2-identificacion.pdf', 'VALIDO'),
    (N'aspirante2.pruebas@cuc.ac.cr', N'Constancia salarial', N'prueba-a2-constancia.pdf', 'VALIDO'),
    (N'aspirante2.pruebas@cuc.ac.cr', N'Historial académico', N'prueba-a2-historial.pdf', 'PENDIENTE'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'Identificación', N'prueba-a3-identificacion.pdf', 'VALIDO'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'Constancia salarial', N'prueba-a3-constancia.pdf', 'VALIDO'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'Historial académico', N'prueba-a3-historial.pdf', 'VALIDO'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'Identificación', N'prueba-a4-identificacion.pdf', 'VALIDO'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'Constancia salarial', N'prueba-a4-constancia.pdf', 'VALIDO'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'Historial académico', N'prueba-a4-historial.pdf', 'VALIDO')
) AS datos(Correo, NombreRequisito, NombreInterno, Estado)
JOIN dbo.Usuarios u ON u.Correo = datos.Correo
JOIN dbo.Solicitudes s ON s.IdUsuario = u.IdUsuario
JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria AND c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I'
JOIN dbo.RequisitosConvocatoria req ON req.IdConvocatoria = c.IdConvocatoria AND req.Nombre = datos.NombreRequisito
JOIN dbo.Archivos a ON a.NombreInterno = datos.NombreInterno
WHERE NOT EXISTS (SELECT 1 FROM dbo.DocumentosSolicitud d WHERE d.IdSolicitud = s.IdSolicitud AND d.IdRequisito = req.IdRequisito);
GO

-- =====================================================================
-- 7. EXPEDIENTES (aspirantes 2, 3 y 4)
-- =====================================================================

INSERT INTO dbo.Expedientes (IdSolicitud, CodigoExpediente, Estado, FechaApertura, FechaCierre)
SELECT s.IdSolicitud, datos.Codigo, datos.Estado, s.FechaEnvio, datos.FechaCierre
FROM (VALUES
    (N'aspirante2.pruebas@cuc.ac.cr', N'EXP-PRUEBA-002', 'EN_REVISION_DOCUMENTAL', NULL),
    (N'aspirante3.pruebas@cuc.ac.cr', N'EXP-PRUEBA-003', 'EN_COMITE', NULL),
    (N'aspirante4.pruebas@cuc.ac.cr', N'EXP-PRUEBA-004', 'APROBADA', SYSUTCDATETIME())
) AS datos(Correo, Codigo, Estado, FechaCierre)
JOIN dbo.Usuarios u ON u.Correo = datos.Correo
JOIN dbo.Solicitudes s ON s.IdUsuario = u.IdUsuario
WHERE NOT EXISTS (SELECT 1 FROM dbo.Expedientes e WHERE e.CodigoExpediente = datos.Codigo);
GO

-- Historial de estados por expediente
INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
SELECT e.IdExpediente, NULL, 'EN_REVISION_DOCUMENTAL', s.IdUsuario, N'Expediente generado al enviar la solicitud (dato de prueba).'
FROM dbo.Expedientes e
JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-002', N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.HistorialEstadosExpediente h WHERE h.IdExpediente = e.IdExpediente);

INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
SELECT e.IdExpediente, 'EN_REVISION_DOCUMENTAL', 'ELEGIBLE', ts.IdUsuario, N'Declarado elegible (dato de prueba).'
FROM dbo.Expedientes e
JOIN dbo.Usuarios ts ON ts.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.HistorialEstadosExpediente h WHERE h.IdExpediente = e.IdExpediente AND h.EstadoNuevo = 'ELEGIBLE');

INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
SELECT e.IdExpediente, 'ELEGIBLE', 'EVALUADA', ts.IdUsuario, N'Evaluación integral registrada (dato de prueba).'
FROM dbo.Expedientes e
JOIN dbo.Usuarios ts ON ts.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.HistorialEstadosExpediente h WHERE h.IdExpediente = e.IdExpediente AND h.EstadoNuevo = 'EVALUADA');

INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
SELECT e.IdExpediente, 'EVALUADA', 'EN_COMITE', ts.IdUsuario, N'Enviado al comité (dato de prueba).'
FROM dbo.Expedientes e
JOIN dbo.Usuarios ts ON ts.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.HistorialEstadosExpediente h WHERE h.IdExpediente = e.IdExpediente AND h.EstadoNuevo = 'EN_COMITE');

INSERT INTO dbo.HistorialEstadosExpediente (IdExpediente, EstadoAnterior, EstadoNuevo, IdUsuario, Observacion)
SELECT e.IdExpediente, 'EN_COMITE', 'APROBADA', com.IdUsuario, N'Aprobado por el comité de becas (dato de prueba).'
FROM dbo.Expedientes e
JOIN dbo.Usuarios com ON com.Correo = N'comite.pruebas@cuc.ac.cr'
WHERE e.CodigoExpediente = N'EXP-PRUEBA-004'
AND NOT EXISTS (SELECT 1 FROM dbo.HistorialEstadosExpediente h WHERE h.IdExpediente = e.IdExpediente AND h.EstadoNuevo = 'APROBADA');
GO

-- Asignación a la trabajadora social de prueba
INSERT INTO dbo.AsignacionesExpediente (IdExpediente, IdEmpleado, IdAsignadoPor)
SELECT e.IdExpediente, emp.IdEmpleado, admin.IdUsuario
FROM dbo.Expedientes e
JOIN dbo.Usuarios admin ON admin.Correo = N'admin.pruebas@cuc.ac.cr'
JOIN dbo.Usuarios empUsuario ON empUsuario.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
JOIN dbo.Empleados emp ON emp.IdUsuario = empUsuario.IdUsuario
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-002', N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.AsignacionesExpediente asg WHERE asg.IdExpediente = e.IdExpediente AND asg.Activa = 1);
GO

-- Elegibilidad (aspirantes 3 y 4)
INSERT INTO dbo.ElegibilidadesExpediente (IdExpediente, EsElegible, Motivo, IdResueltoPor)
SELECT e.IdExpediente, 1, NULL, ts.IdUsuario
FROM dbo.Expedientes e
JOIN dbo.Usuarios ts ON ts.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
WHERE e.CodigoExpediente IN (N'EXP-PRUEBA-003', N'EXP-PRUEBA-004')
AND NOT EXISTS (SELECT 1 FROM dbo.ElegibilidadesExpediente el WHERE el.IdExpediente = e.IdExpediente);
GO

-- =====================================================================
-- 8. EVALUACIÓN INTEGRAL Y RANKING (aspirantes 3 y 4)
-- =====================================================================

INSERT INTO dbo.EvaluacionesExpediente (IdExpediente, IdEvaluador, Estado, PuntajeTotal, FechaFinalizacion)
SELECT e.IdExpediente, ts.IdUsuario, 'COMPLETA', datos.PuntajeTotal, DATEADD(DAY, -2, SYSUTCDATETIME())
FROM dbo.Expedientes e
JOIN dbo.Usuarios ts ON ts.Correo = N'trabajosocial.pruebas@cuc.ac.cr'
JOIN (VALUES (N'EXP-PRUEBA-003', 76.00), (N'EXP-PRUEBA-004', 82.00)) AS datos(Codigo, PuntajeTotal) ON datos.Codigo = e.CodigoExpediente
WHERE NOT EXISTS (SELECT 1 FROM dbo.EvaluacionesExpediente ev WHERE ev.IdExpediente = e.IdExpediente);
GO

-- Puntajes por componente (Académico 40%, Socioeconómico 40%, Méritos 20%; ver datos semilla de ComponentesEvaluacion)
INSERT INTO dbo.PuntajesEvaluacion (IdEvaluacion, IdComponente, Puntaje, PorcentajeAplicado, PuntajePonderado, Observacion)
SELECT ev.IdEvaluacion, comp.IdComponente, datos.Puntaje, comp.Porcentaje, ROUND(datos.Puntaje * comp.Porcentaje / 100.0, 2), NULL
FROM dbo.EvaluacionesExpediente ev
JOIN dbo.Expedientes e ON e.IdExpediente = ev.IdExpediente
JOIN (VALUES
    (N'EXP-PRUEBA-003', N'ACADEMICO', 85.00),
    (N'EXP-PRUEBA-003', N'SOCIOECONOMICO', 75.00),
    (N'EXP-PRUEBA-003', N'MERITOS', 60.00),
    (N'EXP-PRUEBA-004', N'ACADEMICO', 90.00),
    (N'EXP-PRUEBA-004', N'SOCIOECONOMICO', 80.00),
    (N'EXP-PRUEBA-004', N'MERITOS', 70.00)
) AS datos(Codigo, CodigoComponente, Puntaje) ON datos.Codigo = e.CodigoExpediente
JOIN dbo.ComponentesEvaluacion comp ON comp.Codigo = datos.CodigoComponente
WHERE NOT EXISTS (SELECT 1 FROM dbo.PuntajesEvaluacion p WHERE p.IdEvaluacion = ev.IdEvaluacion AND p.IdComponente = comp.IdComponente);
GO

-- Ranking de la convocatoria (aspirante4 primero por mayor puntaje)
INSERT INTO dbo.RankingsConvocatoria (IdConvocatoria, IdExpediente, PuntajeTotal, Posicion)
SELECT c.IdConvocatoria, e.IdExpediente, ev.PuntajeTotal, datos.Posicion
FROM dbo.Expedientes e
JOIN dbo.EvaluacionesExpediente ev ON ev.IdExpediente = e.IdExpediente
JOIN dbo.Solicitudes s ON s.IdSolicitud = e.IdSolicitud
JOIN dbo.Convocatorias c ON c.IdConvocatoria = s.IdConvocatoria
JOIN (VALUES (N'EXP-PRUEBA-004', 1), (N'EXP-PRUEBA-003', 2)) AS datos(Codigo, Posicion) ON datos.Codigo = e.CodigoExpediente
WHERE NOT EXISTS (SELECT 1 FROM dbo.RankingsConvocatoria r WHERE r.IdExpediente = e.IdExpediente);
GO

-- =====================================================================
-- 9. COMITÉ: SESIÓN CERRADA CON DECISIÓN Y RESOLUCIÓN PUBLICADA (aspirante 4)
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.ComitesBeca WHERE Nombre = N'Comité de Becas')
    INSERT INTO dbo.ComitesBeca (Nombre, Periodo) VALUES (N'Comité de Becas', N'Vigente');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SesionesComite WHERE Nombre = N'Sesión de prueba - cerrada')
    INSERT INTO dbo.SesionesComite (IdComite, IdConvocatoria, Nombre, Estado, IdCreadoPor, FechaCierre)
    SELECT com.IdComite, c.IdConvocatoria, N'Sesión de prueba - cerrada', 'CERRADA', u.IdUsuario, DATEADD(DAY, -1, SYSUTCDATETIME())
    FROM dbo.ComitesBeca com, dbo.Convocatorias c, dbo.Usuarios u
    WHERE com.Nombre = N'Comité de Becas'
      AND c.Nombre = N'Convocatoria Ordinaria de Prueba 2026-I'
      AND u.Correo = N'comite.pruebas@cuc.ac.cr';
GO

INSERT INTO dbo.CasosSesionComite (IdSesionComite, IdExpediente, OrdenRevision, Estado)
SELECT ses.IdSesionComite, e.IdExpediente, 1, 'DECIDIDO'
FROM dbo.SesionesComite ses, dbo.Expedientes e
WHERE ses.Nombre = N'Sesión de prueba - cerrada' AND e.CodigoExpediente = N'EXP-PRUEBA-004'
AND NOT EXISTS (SELECT 1 FROM dbo.CasosSesionComite cs WHERE cs.IdSesionComite = ses.IdSesionComite AND cs.IdExpediente = e.IdExpediente);
GO

INSERT INTO dbo.DecisionesComite (IdCasoSesion, TipoDecision, PorcentajeBeca, Motivo, IdRegistradoPor, Vigente)
SELECT cs.IdCasoSesion, 'APROBADA', 80.00, N'Cumple todos los criterios de elegibilidad y obtuvo el mayor puntaje (dato de prueba).', u.IdUsuario, 1
FROM dbo.CasosSesionComite cs
JOIN dbo.SesionesComite ses ON ses.IdSesionComite = cs.IdSesionComite AND ses.Nombre = N'Sesión de prueba - cerrada'
JOIN dbo.Usuarios u ON u.Correo = N'comite.pruebas@cuc.ac.cr'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DecisionesComite d WHERE d.IdCasoSesion = cs.IdCasoSesion);
GO

INSERT INTO dbo.ResolucionesBeca (IdExpediente, IdDecision, NumeroResolucion, TipoResultado, PorcentajeBeca, Motivo, Publicada)
SELECT e.IdExpediente, d.IdDecision, N'RES-PRUEBA-004', 'APROBADA', 80.00, N'Cumple todos los criterios de elegibilidad y obtuvo el mayor puntaje (dato de prueba).', 1
FROM dbo.Expedientes e
JOIN dbo.CasosSesionComite cs ON cs.IdExpediente = e.IdExpediente
JOIN dbo.DecisionesComite d ON d.IdCasoSesion = cs.IdCasoSesion AND d.Vigente = 1
WHERE e.CodigoExpediente = N'EXP-PRUEBA-004'
AND NOT EXISTS (SELECT 1 FROM dbo.ResolucionesBeca r WHERE r.IdExpediente = e.IdExpediente);
GO

-- =====================================================================
-- 10. NOTIFICACIONES DE EJEMPLO
-- =====================================================================

INSERT INTO dbo.Notificaciones (IdUsuario, Tipo, Titulo, Mensaje, Enlace, Leida)
SELECT u.IdUsuario, datos.Tipo, datos.Titulo, datos.Mensaje, REPLACE(datos.Enlace, '{id}', CAST(s.IdSolicitud AS NVARCHAR(10))), 0
FROM (VALUES
    (N'aspirante2.pruebas@cuc.ac.cr', N'SOLICITUD_ENVIADA', N'Solicitud enviada', N'Su solicitud fue enviada y se encuentra en revisión documental.', N'/aspirante/solicitudes/{id}/resultado'),
    (N'aspirante3.pruebas@cuc.ac.cr', N'ELEGIBILIDAD_RESUELTA', N'Su solicitud es elegible', N'Su solicitud cumplió los requisitos y fue enviada al comité de becas.', N'/aspirante/solicitudes/{id}/resultado'),
    (N'aspirante4.pruebas@cuc.ac.cr', N'RESOLUCION_PUBLICADA', N'Resultado disponible', N'Su solicitud de beca fue aprobada. Consulte el detalle de la resolución.', N'/aspirante/solicitudes/{id}/resultado')
) AS datos(Correo, Tipo, Titulo, Mensaje, Enlace)
JOIN dbo.Usuarios u ON u.Correo = datos.Correo
JOIN dbo.Solicitudes s ON s.IdUsuario = u.IdUsuario
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Notificaciones n WHERE n.IdUsuario = u.IdUsuario AND n.Tipo = datos.Tipo
);
GO

-- =====================================================================
-- 11. NOTICIA PÚBLICA ADICIONAL
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Noticias WHERE Titulo = N'Apertura de la Convocatoria Ordinaria de Prueba 2026-I')
    INSERT INTO dbo.Noticias (Titulo, Contenido, PublicoDestino, Estado, IdAutor, FechaPublicacion)
    SELECT N'Apertura de la Convocatoria Ordinaria de Prueba 2026-I',
        N'Ya se encuentra abierta la recepción de solicitudes de la Convocatoria Ordinaria de Prueba 2026-I. Consulte los requisitos en la sección de convocatorias.',
        'GENERAL', 'PUBLICADA', u.IdUsuario, DATEADD(DAY, -5, SYSUTCDATETIME())
    FROM dbo.Usuarios u WHERE u.Correo = N'admin.pruebas@cuc.ac.cr';
GO

PRINT 'Datos de prueba del Segmento 01 insertados correctamente.';
GO
