DECLARE @Correo NVARCHAR(150) = N'yerdnacr@gmail.com';
DECLARE @IdUsuario INT;

SELECT @IdUsuario = IdUsuario
FROM dbo.Usuarios
WHERE Correo = @Correo;

IF @IdUsuario IS NULL
BEGIN
    PRINT 'No existe un usuario con ese correo.';
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Dependencias directas de autenticación/seguridad
    DELETE FROM dbo.Sesiones WHERE IdUsuario = @IdUsuario;
    DELETE FROM dbo.TokensActivacion WHERE IdUsuario = @IdUsuario;
    DELETE FROM dbo.TokensRecuperacion WHERE IdUsuario = @IdUsuario;
    DELETE FROM dbo.RetosDosFactores WHERE IdUsuario = @IdUsuario;
    DELETE FROM dbo.UsuariosRoles WHERE IdUsuario = @IdUsuario;
    DELETE FROM dbo.EnviosCorreo WHERE IdUsuario = @IdUsuario;

    -- Si tiene datos de negocio asociados, esto podría fallar por FK (es intencional).
    DELETE FROM dbo.Usuarios WHERE IdUsuario = @IdUsuario;

    COMMIT TRANSACTION;
    PRINT 'Usuario eliminado correctamente.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;