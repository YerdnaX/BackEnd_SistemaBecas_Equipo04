/**
 * Combina los requisitos plantilla de una beca (RequisitosBeca, ya filtrados
 * por IdTipoBeca y Activo=1 en la consulta que llama a esta funcion) con los
 * requisitos adicionales especificos de una convocatoria, en la forma que
 * espera el INSERT de RequisitosConvocatoria. Pura y sin acceso a datos para
 * poder probarla sin base de datos: dado que cada llamada solo recibe los
 * requisitos de una beca, dos becas nunca terminan mezclando sus requisitos.
 */
export function combinarRequisitosConvocatoria(requisitosBeca = [], requisitosAdicionales = []) {
  const deBeca = requisitosBeca.map((requisito) => ({
    nombre: requisito.Nombre ?? requisito.nombre,
    descripcion: requisito.Descripcion ?? requisito.descripcion ?? null,
    idTipoDocumento: requisito.IdTipoDocumento ?? requisito.idTipoDocumento ?? null,
    obligatorio: (requisito.Obligatorio ?? requisito.obligatorio) !== false
  }));

  const adicionales = requisitosAdicionales.map((requisito) => ({
    nombre: requisito.nombre,
    descripcion: requisito.descripcion || null,
    idTipoDocumento: requisito.idTipoDocumento || null,
    obligatorio: requisito.obligatorio !== false
  }));

  return [...deBeca, ...adicionales];
}
