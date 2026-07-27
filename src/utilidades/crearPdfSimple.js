function escaparPdf(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

function dividirPalabra(palabra, maximo) {
  const partes = [];
  for (let indice = 0; indice < palabra.length; indice += maximo) {
    partes.push(palabra.slice(indice, indice + maximo));
  }
  return partes;
}

function ajustarParrafo(parrafo, maximo) {
  if (!parrafo.trim()) return [''];
  const palabras = parrafo.trim().split(/\s+/).flatMap((palabra) =>
    palabra.length > maximo ? dividirPalabra(palabra, maximo) : [palabra]
  );
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    if (!actual) {
      actual = palabra;
    } else if (`${actual} ${palabra}`.length <= maximo) {
      actual = `${actual} ${palabra}`;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export function prepararLineasPdf(lineas, maximoCaracteres = 82) {
  return lineas.flatMap((linea) =>
    String(linea ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/&&/g, '\n')
      .split('\n')
      .flatMap((parrafo) => ajustarParrafo(parrafo, maximoCaracteres))
  );
}

export function crearPdfSimple(lineas) {
  const instrucciones = prepararLineasPdf(lineas)
    .slice(0, 42)
    .map((linea, indice) => `BT /F1 11 Tf 50 ${790 - indice * 18} Td (${escaparPdf(linea)}) Tj ET`)
    .join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(instrucciones)} >>\nstream\n${instrucciones}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objetos.forEach((objeto, indice) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}
