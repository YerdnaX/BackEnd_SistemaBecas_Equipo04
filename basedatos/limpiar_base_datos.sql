-- =====================================================================
-- Sistema de Gestion de Becas Estudiantiles (SGBE) - CUC
-- Limpieza completa de datos (mantiene estructura de tablas)
-- Motor: SQL Server
--
-- Uso:
-- 1) Ejecutar sobre la base destino (por ejemplo tiusr15pl_SGBE_CUC_Equipo04).
-- 2) Este script elimina TODOS los registros de todas las tablas del sistema.
-- 3) No elimina tablas, indices ni restricciones; solo limpia datos.
-- =====================================================================

SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Desactivar restricciones para permitir borrado masivo.
    ALTER TABLE dbo.UsuariosRoles NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RolesPermisos NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Sesiones NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.TokensActivacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.TokensRecuperacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RetosDosFactores NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Empleados NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.MiembrosComite NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AuditoriaAcciones NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EventosSeguridad NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RubrosCobertura NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CriteriosElegibilidad NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RequisitosConvocatoria NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EtapasConvocatoria NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEtapasConvocatoria NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Archivos NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Solicitudes NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosPersonalesSolicitud NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosAcademicosSolicitud NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosSocioeconomicosSolicitud NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.MiembrosGrupoFamiliar NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosSolicitud NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RevisionesDocumento NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Expedientes NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEstadosExpediente NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AsignacionesExpediente NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ElegibilidadesExpediente NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EvaluacionesExpediente NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.PuntajesEvaluacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RankingsConvocatoria NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.SesionesComite NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CasosSesionComite NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DecisionesComite NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ActasComite NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Notificaciones NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EnviosCorreo NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.FormalizacionesBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ConveniosBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.BecasActivas NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ActivacionesFinancieras NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ValidacionesAcademicas NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.SeguimientosBecado NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RendimientosAcademicos NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AlertasSeguimiento NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.JustificacionesCurso NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosJustificacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.VisitasDomiciliarias NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.InformesVisita NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ConsultasUsuarios NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RespuestasConsulta NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Noticias NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RenovacionesBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosRenovacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesRenovacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Apelaciones NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosApelacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RevisionesApelacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesApelacion NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.InvestigacionesBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DescargosBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesSuspension NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEstadosBeca NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CierresExpediente NOCHECK CONSTRAINT ALL;
    ALTER TABLE dbo.PreguntasRespuestasChatbot NOCHECK CONSTRAINT ALL;

    -- Eliminar todos los datos.
    DELETE FROM dbo.UsuariosRoles;
    DELETE FROM dbo.RolesPermisos;
    DELETE FROM dbo.Sesiones;
    DELETE FROM dbo.TokensActivacion;
    DELETE FROM dbo.TokensRecuperacion;
    DELETE FROM dbo.RetosDosFactores;
    DELETE FROM dbo.Empleados;
    DELETE FROM dbo.MiembrosComite;
    DELETE FROM dbo.AuditoriaAcciones;
    DELETE FROM dbo.EventosSeguridad;
    DELETE FROM dbo.RubrosCobertura;
    DELETE FROM dbo.CriteriosElegibilidad;
    DELETE FROM dbo.RequisitosConvocatoria;
    DELETE FROM dbo.EtapasConvocatoria;
    DELETE FROM dbo.HistorialEtapasConvocatoria;
    DELETE FROM dbo.Archivos;
    DELETE FROM dbo.Solicitudes;
    DELETE FROM dbo.DatosPersonalesSolicitud;
    DELETE FROM dbo.DatosAcademicosSolicitud;
    DELETE FROM dbo.DatosSocioeconomicosSolicitud;
    DELETE FROM dbo.MiembrosGrupoFamiliar;
    DELETE FROM dbo.DocumentosSolicitud;
    DELETE FROM dbo.RevisionesDocumento;
    DELETE FROM dbo.Expedientes;
    DELETE FROM dbo.HistorialEstadosExpediente;
    DELETE FROM dbo.AsignacionesExpediente;
    DELETE FROM dbo.ElegibilidadesExpediente;
    DELETE FROM dbo.EvaluacionesExpediente;
    DELETE FROM dbo.PuntajesEvaluacion;
    DELETE FROM dbo.RankingsConvocatoria;
    DELETE FROM dbo.SesionesComite;
    DELETE FROM dbo.CasosSesionComite;
    DELETE FROM dbo.DecisionesComite;
    DELETE FROM dbo.ResolucionesBeca;
    DELETE FROM dbo.ActasComite;
    DELETE FROM dbo.Notificaciones;
    DELETE FROM dbo.EnviosCorreo;
    DELETE FROM dbo.FormalizacionesBeca;
    DELETE FROM dbo.ConveniosBeca;
    DELETE FROM dbo.BecasActivas;
    DELETE FROM dbo.ActivacionesFinancieras;
    DELETE FROM dbo.ValidacionesAcademicas;
    DELETE FROM dbo.SeguimientosBecado;
    DELETE FROM dbo.RendimientosAcademicos;
    DELETE FROM dbo.AlertasSeguimiento;
    DELETE FROM dbo.JustificacionesCurso;
    DELETE FROM dbo.DocumentosJustificacion;
    DELETE FROM dbo.VisitasDomiciliarias;
    DELETE FROM dbo.InformesVisita;
    DELETE FROM dbo.ConsultasUsuarios;
    DELETE FROM dbo.RespuestasConsulta;
    DELETE FROM dbo.Noticias;
    DELETE FROM dbo.RenovacionesBeca;
    DELETE FROM dbo.DocumentosRenovacion;
    DELETE FROM dbo.ResolucionesRenovacion;
    DELETE FROM dbo.Apelaciones;
    DELETE FROM dbo.DocumentosApelacion;
    DELETE FROM dbo.RevisionesApelacion;
    DELETE FROM dbo.ResolucionesApelacion;
    DELETE FROM dbo.InvestigacionesBeca;
    DELETE FROM dbo.DescargosBeca;
    DELETE FROM dbo.ResolucionesSuspension;
    DELETE FROM dbo.HistorialEstadosBeca;
    DELETE FROM dbo.CierresExpediente;
    DELETE FROM dbo.PreguntasRespuestasChatbot;

    -- Catalogos/base de seguridad y configuracion.
    DELETE FROM dbo.ComponentesEvaluacion;
    DELETE FROM dbo.PlantillasMensajes;
    DELETE FROM dbo.ConfiguracionesSistema;
    DELETE FROM dbo.Convocatorias;
    DELETE FROM dbo.TiposDocumento;
    DELETE FROM dbo.TiposBeca;
    DELETE FROM dbo.ComitesBeca;
    DELETE FROM dbo.Usuarios;
    DELETE FROM dbo.Permisos;
    DELETE FROM dbo.Roles;

    -- Reactivar restricciones.
    ALTER TABLE dbo.UsuariosRoles WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RolesPermisos WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Sesiones WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.TokensActivacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.TokensRecuperacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RetosDosFactores WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Empleados WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.MiembrosComite WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AuditoriaAcciones WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EventosSeguridad WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RubrosCobertura WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CriteriosElegibilidad WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RequisitosConvocatoria WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EtapasConvocatoria WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEtapasConvocatoria WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Archivos WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Solicitudes WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosPersonalesSolicitud WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosAcademicosSolicitud WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DatosSocioeconomicosSolicitud WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.MiembrosGrupoFamiliar WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosSolicitud WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RevisionesDocumento WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Expedientes WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEstadosExpediente WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AsignacionesExpediente WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ElegibilidadesExpediente WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EvaluacionesExpediente WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.PuntajesEvaluacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RankingsConvocatoria WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.SesionesComite WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CasosSesionComite WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DecisionesComite WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ActasComite WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Notificaciones WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.EnviosCorreo WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.FormalizacionesBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ConveniosBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.BecasActivas WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ActivacionesFinancieras WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ValidacionesAcademicas WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.SeguimientosBecado WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RendimientosAcademicos WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.AlertasSeguimiento WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.JustificacionesCurso WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosJustificacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.VisitasDomiciliarias WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.InformesVisita WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ConsultasUsuarios WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RespuestasConsulta WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Noticias WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RenovacionesBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosRenovacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesRenovacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.Apelaciones WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DocumentosApelacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.RevisionesApelacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesApelacion WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.InvestigacionesBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.DescargosBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.ResolucionesSuspension WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.HistorialEstadosBeca WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.CierresExpediente WITH CHECK CHECK CONSTRAINT ALL;
    ALTER TABLE dbo.PreguntasRespuestasChatbot WITH CHECK CHECK CONSTRAINT ALL;

    COMMIT TRANSACTION;
    PRINT 'Limpieza completa realizada. La estructura de tablas se mantiene.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @MensajeError NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @NumeroError INT = ERROR_NUMBER();
    DECLARE @EstadoError INT = ERROR_STATE();

    RAISERROR('Error al limpiar la base de datos: %s', 16, 1, @MensajeError) WITH NOWAIT;
    RAISERROR('Detalle tecnico (numero=%d, estado=%d).', 16, 1, @NumeroError, @EstadoError) WITH NOWAIT;
END CATCH;
GO
