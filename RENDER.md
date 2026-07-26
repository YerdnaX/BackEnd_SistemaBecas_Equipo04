# Despliegue del backend en Render

## 0. Prerrequisito: repositorio Git

Render despliega desde un repositorio Git (GitHub, GitLab o Bitbucket). Este proyecto todavía no es un repositorio Git local. Antes de continuar:

```bash
cd "ProyectoProgramado"        # raíz del proyecto (contiene BackEnd, FrontEnd, Mookups)
git init
git add BackEnd FrontEnd Mookups documentacion agend.md
git commit -m "Version inicial Segmento 01"
```

Cree un repositorio vacío en GitHub (por ejemplo `sgbe-cuc`) y súbalo:

```bash
git remote add origin https://github.com/<su-usuario>/sgbe-cuc.git
git push -u origin main
```

**Verifique que `BackEnd/.env` no se incluya en el commit** (`BackEnd/.gitignore` ya lo excluye) — contiene la contraseña real de la base de datos.

## 1. Datos de conexión confirmados

El servidor de SQL Server es compartido por varios proyectos del equipo; cada proyecto tiene su propia base de datos en el mismo host:

| Variable | Valor |
|---|---|
| `DB_SERVER` | `tiusr15pl.cuc-carrera-ti.ac.cr` |
| `DB_PORT` | `1433` |
| `DB_DATABASE` | `tiusr15pl_SGBE_CUC_Equipo04` |
| `DB_USER` | `Equipo04` |
| `DB_PASSWORD` | *(la contraseña real; no se repite aquí — cópiela de `BackEnd/.env` local o solicítela al equipo)* |

Conectividad verificada localmente con `npm run verificar:conexion` (ver `BackEnd/basedatos/README_BASE_DATOS.md`).

## 2. Crear el Web Service en Render

1. Ingrese a [render.com](https://render.com) → **New** → **Web Service**.
2. Conecte el repositorio `sgbe-cuc` (o el nombre que haya usado) creado en el paso 0.
3. Configure:
   - **Name:** `sgbe-backend` (o el que prefiera).
   - **Region:** la más cercana disponible.
   - **Root Directory:** `BackEnd`.
   - **Runtime:** Node.
   - **Build Command:** `npm ci`.
   - **Start Command:** `npm start`.
   - **Instance Type:** Free o el plan que corresponda.
4. **No** haga clic en "Create Web Service" todavía: primero configure las variables de entorno (paso 3), para que el primer despliegue ya arranque correctamente.

## 3. Variables de entorno (Render → Environment)

Agregue cada una como variable individual (todas quedan cifradas por Render; ninguna se sube al repositorio):

```
NODE_ENV=production
DB_SERVER=tiusr15pl.cuc-carrera-ti.ac.cr
DB_PORT=1433
DB_DATABASE=tiusr15pl_SGBE_CUC_Equipo04
DB_USER=Equipo04
DB_PASSWORD=<contraseña real>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=<genere uno nuevo, ver comando abajo>
JWT_REFRESH_SECRET=<genere otro distinto>
JWT_DURACION=15m
JWT_REFRESH_DURACION=7d
URL_FRONTEND=https://<dominio-del-frontend-en-plesk>
SMTP_FROM=SGBE CUC <no-responder@cuc.ac.cr>
GOOGLE_OAUTH_CLIENT_ID=<client_id.apps.googleusercontent.com>
GOOGLE_OAUTH_CLIENT_SECRET=<client_secret>
GOOGLE_OAUTH_REFRESH_TOKEN=<refresh_token_oauth2>
GOOGLE_OAUTH_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_OAUTH_USER=me
TAMANO_MAXIMO_ARCHIVO_MB=8
OTP_DURACION_MINUTOS=10
OTP_INTENTOS_MAXIMOS=5
TOKEN_ACTIVACION_HORAS=24
TOKEN_RECUPERACION_HORAS=24

# SMTP opcional (solo fallback)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

`PORT` no se configura: Render lo inyecta automáticamente y el servidor ya lee `process.env.PORT`.

Para generar `JWT_SECRET`/`JWT_REFRESH_SECRET` (deben ser distintos a los usados en desarrollo local):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Ejecútelo dos veces y use un valor para cada variable.

### 3.1 Obtener credenciales de Google API (Gmail) para 2FA

1. Cree o elija un proyecto en Google Cloud Console.
   - Abra https://console.cloud.google.com/.
   - Menú de proyecto (arriba) → **New Project**.

2. Configure la pantalla de consentimiento OAuth.
   - API & Services → **OAuth consent screen**.
   - Tipo recomendado para pruebas institucionales: **External**.
   - Complete nombre de app, correo de soporte y correo del desarrollador.
   - En **Scopes**, agregue `.../auth/gmail.send`.
   - En **Test users**, agregue la cuenta Gmail remitente que usará el sistema.

3. Habilite la API de Gmail.
   - API & Services → **Library**.
   - Busque **Gmail API** → **Enable**.

4. Cree credenciales OAuth 2.0.
   - API & Services → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Tipo: **Web application**.
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`.
   - Guarde `Client ID` y `Client Secret`.

5. Obtenga el refresh token en OAuth Playground.
   - Abra https://developers.google.com/oauthplayground.
   - Ícono de engranaje (arriba derecha): active **Use your own OAuth credentials**.
   - Pegue el `Client ID` y `Client Secret`.
   - En el panel izquierdo, seleccione el scope `https://www.googleapis.com/auth/gmail.send`.
   - Click **Authorize APIs** y acepte con el correo remitente.
   - Click **Exchange authorization code for tokens**.
   - Copie el `refresh_token`.

6. Cargue valores en Render.
   - `GOOGLE_OAUTH_CLIENT_ID` = Client ID.
   - `GOOGLE_OAUTH_CLIENT_SECRET` = Client Secret.
   - `GOOGLE_OAUTH_REFRESH_TOKEN` = refresh_token.
   - `GOOGLE_OAUTH_REDIRECT_URI` = `https://developers.google.com/oauthplayground`.
   - `GOOGLE_OAUTH_USER` = `me`.
   - `SMTP_FROM` = remitente visible (por ejemplo `SGBE CUC <no-responder@cuc.ac.cr>`).

7. Validación recomendada posterior al deploy.
   - Inicie sesión con un usuario nuevo (creado después de la migración 2FA).
   - Debe recibir código por correo y completar segundo paso de login.
   - Revise `dbo.EnviosCorreo`: debe quedar en `ENVIADO`.

Si las variables `GOOGLE_OAUTH_*` no están completas en producción, el backend rechazará el envío de correos y el inicio de sesión con 2FA no podrá completarse para usuarios nuevos.

## 4. Desplegar

1. Haga clic en **Create Web Service**. Render instala dependencias y ejecuta `npm start`.
2. Espere a que el estado quede en **Live** y revise los logs: debe aparecer `API SGBE escuchando en el puerto ... (production).`
3. Pruebe el health check: `https://<su-servicio>.onrender.com/api/salud` debe responder `{"exito":true,...}`.

## 5. Preparar la base de datos (una sola vez)

Si `tiusr15pl_SGBE_CUC_Equipo04` todavía no tiene las tablas del sistema:

```bash
# Desde su máquina local, con BackEnd/.env apuntando a los mismos datos de conexión:
cd BackEnd
# Ejecute BackEnd/basedatos/crear_base_datos.sql contra el servidor con su cliente SQL preferido
# (Azure Data Studio, SSMS, o sqlcmd -S tiusr15pl.cuc-carrera-ti.ac.cr -U Equipo04 -P "..." -i basedatos/crear_base_datos.sql)
# Ejecute datos_prueba.sql para aplicar en una sola corrida los ajustes
# idempotentes de Segmento 03 + 2FA y, opcionalmente, cargar cuentas de prueba:
# sqlcmd -S tiusr15pl.cuc-carrera-ti.ac.cr -U Equipo04 -P "..." -i basedatos/datos_prueba.sql
npm run verificar:conexion
ADMIN_CORREO=admin@cuc.ac.cr ADMIN_CONTRASENA="Cambiar123!" npm run crear:administrador
```

No es necesario ejecutar esto desde Render: como el script es idempotente, también puede correrlo apuntando `BackEnd/.env` local al mismo servidor (ya lo hace por defecto).

## 6. Actualizar CORS cuando el frontend tenga dominio final

`URL_FRONTEND` en Render debe coincidir exactamente con la URL pública del frontend en Plesk (con `https://`). Si cambia el dominio, actualice la variable y Render reiniciará el servicio automáticamente.

## Notas importantes

- CORS usa un origen específico (`URL_FRONTEND`), nunca `*`, porque las peticiones autenticadas llevan credenciales.
- El servidor cierra el pool de conexiones SQL de forma ordenada al recibir `SIGINT`/`SIGTERM` (ver `src/servidor.js`), como exige Render al reiniciar instancias.
- No existen archivos servidos desde disco local: los documentos cargados se guardan en la tabla `Archivos` (`VARBINARY(MAX)`) porque Render no garantiza persistencia de disco entre despliegues.
- Cada despliegue nuevo (push a la rama conectada) dispara un build y restart automáticos en Render.
