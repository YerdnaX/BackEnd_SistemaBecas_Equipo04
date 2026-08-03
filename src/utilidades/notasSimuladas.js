// Escala 0-100: misma que DatosAcademicosSolicitud.Promedio, ya vigente en
// el sistema (no existia una escala de notas separada que reutilizar).
const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 100;

/**
 * Valida la lista de materias de las notas simuladas. Devuelve un arreglo
 * de errores {campo, mensaje} (vacio si todo es valido). Pura, sin acceso a
 * datos, para poder probarla sin base de datos.
 */
export function validarMateriasNotas(materias) {
  const errores = [];
  if (!Array.isArray(materias) || materias.length === 0) {
    errores.push({ campo: 'materias', mensaje: 'Debe registrar al menos una materia.' });
    return errores;
  }

  materias.forEach((materia, indice) => {
    if (!materia?.nombreMateria?.trim()) {
      errores.push({ campo: `materias[${indice}].nombreMateria`, mensaje: 'El nombre de la materia es obligatorio.' });
    }
    if (!materia?.periodo?.trim()) {
      errores.push({ campo: `materias[${indice}].periodo`, mensaje: 'El periodo académico es obligatorio.' });
    }
    const nota = Number(materia?.nota);
    if (Number.isNaN(nota) || nota < NOTA_MINIMA || nota > NOTA_MAXIMA) {
      errores.push({ campo: `materias[${indice}].nota`, mensaje: 'La nota debe ser un número entre 0 y 100.' });
    }
  });

  return errores;
}

/**
 * Calcula el promedio de una lista de materias con nota numerica, redondeado
 * a 2 decimales. El backend siempre recalcula este valor; nunca confia en un
 * promedio enviado por el cliente.
 */
export function calcularPromedioNotas(materias) {
  const notas = materias.map((materia) => Number(materia.nota));
  const suma = notas.reduce((total, nota) => total + nota, 0);
  const promedio = suma / notas.length;
  return Math.round(promedio * 100) / 100;
}
