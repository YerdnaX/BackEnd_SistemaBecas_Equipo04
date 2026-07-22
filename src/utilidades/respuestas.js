export function enviarExito(res, { mensaje = 'Operación realizada correctamente.', datos = {}, estadoHttp = 200 } = {}) {
  return res.status(estadoHttp).json({ exito: true, mensaje, datos });
}

export function enviarError(res, { codigo = 'ERROR_INTERNO', mensaje = 'Ocurrió un error inesperado.', errores = [], estadoHttp = 400 } = {}) {
  return res.status(estadoHttp).json({ exito: false, codigo, mensaje, errores });
}
