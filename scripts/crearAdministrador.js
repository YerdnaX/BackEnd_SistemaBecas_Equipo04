import bcrypt from 'bcryptjs';
import { obtenerPool, cerrarPool, sql } from '../src/configuracion/baseDatos.js';
import { contrasenaEsSegura, correoEsValido } from '../src/utilidades/validaciones.js';

const correo = process.env.ADMIN_CORREO;
const contrasena = process.env.ADMIN_CONTRASENA;

async function main() {
  if (!correoEsValido(correo)) {
    throw new Error('Defina ADMIN_CORREO con un correo válido.');
  }
  if (!contrasenaEsSegura(contrasena)) {
    throw new Error('Defina ADMIN_CONTRASENA con al menos 8 caracteres, una mayúscula, un número y un carácter especial.');
  }

  const pool = await obtenerPool();

  const existente = await pool.request()
    .input('correo', sql.NVarChar(150), correo.toLowerCase())
    .query('SELECT IdUsuario FROM dbo.Usuarios WHERE Correo = @correo');

  let idUsuario;
  if (existente.recordset[0]) {
    idUsuario = existente.recordset[0].IdUsuario;
    console.log('El usuario ya existía; se actualizará su rol a ADMINISTRADOR.');
  } else {
    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    const resultado = await pool.request()
      .input('correo', sql.NVarChar(150), correo.toLowerCase())
      .input('contrasenaHash', sql.NVarChar(255), contrasenaHash)
      .query(`
        INSERT INTO dbo.Usuarios (Correo, ContrasenaHash, Nombre, PrimerApellido, Estado, CorreoVerificado)
        OUTPUT INSERTED.IdUsuario
        VALUES (@correo, @contrasenaHash, N'Administración', N'SGBE', 'ACTIVO', 1)
      `);
    idUsuario = resultado.recordset[0].IdUsuario;
  }

  await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol)
      SELECT @idUsuario, IdRol FROM dbo.Roles r
      WHERE r.Codigo = 'ADMINISTRADOR'
        AND NOT EXISTS (SELECT 1 FROM dbo.UsuariosRoles ur WHERE ur.IdUsuario = @idUsuario AND ur.IdRol = r.IdRol)
    `);

  const noticias = await pool.request().query('SELECT COUNT(*) AS total FROM dbo.Noticias');
  if (noticias.recordset[0].total === 0) {
    await pool.request()
      .input('idAutor', sql.Int, idUsuario)
      .query(`
        INSERT INTO dbo.Noticias (Titulo, Contenido, PublicoDestino, Estado, IdAutor, FechaPublicacion)
        VALUES (
          N'Bienvenidos al Sistema de Gestión de Becas Estudiantiles (dato semilla)',
          N'Esta es una noticia de ejemplo cargada como dato semilla para probar la consulta pública de noticias. Debe reemplazarse por contenido institucional real.',
          'GENERAL', 'PUBLICADA', @idAutor, SYSUTCDATETIME()
        )
      `);
    console.log('Noticia semilla creada.');
  }

  console.log('Administrador listo. Ya puede iniciar sesión con el correo indicado.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
