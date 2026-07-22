import crypto from 'node:crypto';

export function generarTokenAleatorio() {
  return crypto.randomBytes(32).toString('hex');
}

export function generarCodigoOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashearValor(valor) {
  return crypto.createHash('sha256').update(valor).digest('hex');
}
