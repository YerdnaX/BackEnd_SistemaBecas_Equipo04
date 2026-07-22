# Base de datos — SGBE CUC

## Requisitos

- SQL Server accesible (local, contenedor o instancia remota).
- Usuario con permisos para crear tablas (idealmente también para crear la base `SGBE_CUC`).

## Pasos para ejecutar el script

1. Completa `BackEnd/.env` con `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER` y `DB_PASSWORD` reales (usa `BackEnd/.env.example` como plantilla).
2. Ejecuta `BackEnd/basedatos/crear_base_datos.sql` con tu cliente preferido:
   - **Azure Data Studio / SSMS:** abre el archivo y ejecútalo (F5) contra el servidor de destino.
   - **sqlcmd:**
     ```bash
     sqlcmd -S <servidor> -U Equipo04 -P "Avalon2020!!" -i BackEnd/basedatos/crear_base_datos.sql
     ```
3. El script:
   - crea la base `SGBE_CUC` si el usuario tiene permiso (si no, usa la base ya seleccionada por la conexión);
   - crea todas las tablas de los 3 segmentos, en orden de dependencias, protegidas con `IF OBJECT_ID(...) IS NULL` (se puede ejecutar varias veces sin error);
   - inserta datos semilla no sensibles: roles, permisos, relación rol-permiso, tipos de documento, componentes de evaluación y configuraciones de plazos.
4. Verifica la conexión desde Node sin exponer credenciales:
   ```bash
   cd BackEnd
   npm run verificar:conexion
   ```
   Debe imprimir únicamente `Conexión a SQL Server exitosa.` o un error genérico si falla.
5. Crea el administrador inicial (también genera la noticia semilla, que requiere un autor):
   ```bash
   cd BackEnd
   ADMIN_CORREO=admin@cuc.ac.cr ADMIN_CONTRASENA="Cambiar123!" node scripts/crearAdministrador.js
   ```
   En Windows PowerShell:
   ```powershell
   $env:ADMIN_CORREO="admin@cuc.ac.cr"; $env:ADMIN_CONTRASENA="Cambiar123!"; node scripts/crearAdministrador.js
   ```

## Servidor confirmado

`DB_SERVER=tiusr15pl.cuc-carrera-ti.ac.cr` y `DB_DATABASE=tiusr15pl_SGBE_CUC_Equipo04` (ver `documentacion/DECISIONES_SEGMENTO_01.md`, sección 2). Ya están completos en `BackEnd/.env` y `BackEnd/.env.example`. La conectividad se verificó con `npm run verificar:conexion`.

## Notas de diseño

- Sin vistas, triggers, cursores, SQL dinámico ni procedimientos almacenados (regla obligatoria del proyecto).
- Borrado lógico con `Activo BIT` en catálogos con historial (p. ej. `TiposBeca`, `Roles`).
- Archivos cargados por los usuarios se guardan en `Archivos.Contenido VARBINARY(MAX)` porque Render no garantiza disco persistente; ver `documentacion/DECISIONES_SEGMENTO_01.md` sección 4.
- Solo las tablas de los dominios del Segmento 01 (identidad, tipos de beca, convocatorias, solicitudes, expedientes, evaluación, comité, notificaciones) tienen API y pantallas funcionales en esta entrega. El resto (formalización, activación financiera, seguimiento, renovación, apelación, suspensión, cierre, chatbot) queda creado para segmentos futuros.
