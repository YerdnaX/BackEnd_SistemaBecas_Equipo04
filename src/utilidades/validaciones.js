export function correoEsValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

export function contrasenaEsSegura(contrasena) {
  const valor = String(contrasena || '');
  return (
    valor.length >= 8 &&
    /[A-Z]/.test(valor) &&
    /[0-9]/.test(valor) &&
    /[^A-Za-z0-9]/.test(valor)
  );
}
