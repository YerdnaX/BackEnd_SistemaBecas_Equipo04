import 'dotenv/config';

function obtenerNumero(valor, porDefecto) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : porDefecto;
}

function obtenerBooleano(valor, porDefecto) {
  if (valor === undefined) return porDefecto;
  return valor === 'true';
}

export const configuracion = {
  entorno: process.env.NODE_ENV || 'development',
  puerto: obtenerNumero(process.env.PORT, 3000),
  baseDatos: {
    servidor: process.env.DB_SERVER || '',
    puerto: obtenerNumero(process.env.DB_PORT, 1433),
    baseDatos: process.env.DB_DATABASE || '',
    usuario: process.env.DB_USER || '',
    contrasena: process.env.DB_PASSWORD || '',
    encriptar: obtenerBooleano(process.env.DB_ENCRYPT, true),
    confiarCertificado: obtenerBooleano(process.env.DB_TRUST_SERVER_CERTIFICATE, true)
  },
  jwt: {
    secreto: process.env.JWT_SECRET || '',
    secretoRefresco: process.env.JWT_REFRESH_SECRET || '',
    duracion: process.env.JWT_DURACION || '15m',
    duracionRefresco: process.env.JWT_REFRESH_DURACION || '7d'
  },
  urlFrontend: process.env.URL_FRONTEND || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    puerto: obtenerNumero(process.env.SMTP_PORT, 587),
    seguro: obtenerBooleano(process.env.SMTP_SECURE, false),
    usuario: process.env.SMTP_USER || '',
    contrasena: process.env.SMTP_PASSWORD || '',
    remitente: process.env.SMTP_FROM || 'SGBE CUC <no-responder@cuc.ac.cr>'
  },
  googleCorreo: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
    usuario: process.env.GOOGLE_OAUTH_USER || ''
  },
  archivos: {
    tamanoMaximoMb: obtenerNumero(process.env.TAMANO_MAXIMO_ARCHIVO_MB, 8),
    extensionesPermitidas: ['pdf', 'jpg', 'jpeg', 'png']
  },
  autenticacion: {
    otpDuracionMinutos: obtenerNumero(process.env.OTP_DURACION_MINUTOS, 10),
    otpIntentosMaximos: obtenerNumero(process.env.OTP_INTENTOS_MAXIMOS, 5),
    tokenActivacionHoras: obtenerNumero(process.env.TOKEN_ACTIVACION_HORAS, 24),
    tokenRecuperacionHoras: obtenerNumero(process.env.TOKEN_RECUPERACION_HORAS, 24),
    limiteTasaHabilitado: obtenerBooleano(process.env.AUTENTICACION_RATE_LIMIT_HABILITADO, false),
    limiteTasaVentanaMs: obtenerNumero(process.env.AUTENTICACION_RATE_LIMIT_VENTANA_MS, 15 * 60 * 1000),
    limiteTasaMaximo: obtenerNumero(process.env.AUTENTICACION_RATE_LIMIT_MAXIMO, 10),
    bloqueoIntentosFallidosHabilitado: obtenerBooleano(process.env.AUTENTICACION_BLOQUEO_INTENTOS_HABILITADO, false)
  },
  asistenteIA: {
    // Proveedor de IA compatible con el protocolo "Chat Completions" (mismo
    // formato de OpenAI). Por defecto apunta a GitHub Models, pero puede
    // apuntar a Google Gemini, Groq, OpenAI u otro cambiando estas 3 variables,
    // sin tocar código. La API key NUNCA se expone al frontend.
    apiKey: process.env.ASISTENTE_IA_API_KEY || '',
    urlBase: process.env.ASISTENTE_IA_URL || 'https://models.github.ai/inference/chat/completions',
    modelo: process.env.ASISTENTE_IA_MODELO || 'openai/gpt-4o-mini',
    timeoutMs: obtenerNumero(process.env.ASISTENTE_IA_TIMEOUT_MS, 20000)
  }
};

export function validarConfiguracionCritica() {
  const faltantes = [];
  if (!configuracion.jwt.secreto) faltantes.push('JWT_SECRET');
  if (!configuracion.jwt.secretoRefresco) faltantes.push('JWT_REFRESH_SECRET');
  if (!configuracion.baseDatos.usuario) faltantes.push('DB_USER');
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
  }
}
