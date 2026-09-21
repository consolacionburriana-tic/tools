import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { analizarExcel } from '@/lib/licencias-codigos-excel';

/** Construye un .xlsx en memoria con las filas dadas (datos inventados, nunca reales). */
function libro(filas: (string | number)[][], nombreHoja = 'Hoja1'): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombreHoja);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const vacia = (n: number) => Array.from({ length: n }, () => ['', '', '', '']);

describe('analizarExcel · los tres formatos que mandan las editoriales', () => {
  it('SM: cabecera en la fila 0, códigos en la segunda columna, ISBN en la última', () => {
    const b = libro([
      ['Nombre Producto', 'Licencias Alumno', 'Licencias Profesor', 'Código de producto', 'ISBN'],
      ['SDA. Français A2.2', 'DHLW9-F3RSM-ACJSD', '', 'ESA215291', '9788498564693'],
      ['SDA. Français A2.2', 'DR7AW-9FSSM-AHXJD', '', 'ESA215291', '9788498564693'],
    ]);
    const r = analizarExcel(b);
    expect(r.columnaSugerida).toBe(1);
    expect(r.codigos).toEqual(['DHLW9-F3RSM-ACJSD', 'DR7AW-9FSSM-AHXJD']);
  });

  it('Cambridge: seis filas de preámbulo antes de la cabecera y columna Code la tercera', () => {
    const b = libro(
      [
        ['Number of licences:', '3'],
        ['Type:', 'Student user'],
        ['School:', 'Colegio de prueba'],
        ['Publisher:', 'Cambridge'],
        ...vacia(5),
        ['ISBN', 'Book', 'Code', 'User', 'Functionality'],
        ['9788413221076', 'Libro de prueba L5', 'ZGU6DX67', 'Students', 'Standard'],
        ['9788413221076', 'Libro de prueba L5', 'A2EAAXW7', 'Students', 'Standard'],
        ['9788413221076', 'Libro de prueba L5', 'YJBLYWR7', 'Students', 'Standard'],
        ...vacia(300), // las ~790 filas vacías del final del fichero real
      ],
      'Digital licences',
    );
    const r = analizarExcel(b);
    expect(r.hoja).toBe('Digital licences');
    expect(r.columnaSugerida).toBe(2);
    expect(r.codigos).toEqual(['ZGU6DX67', 'A2EAAXW7', 'YJBLYWR7']);
  });

  it('Anaya: columna A vacía, cabecera en la fila 1 y códigos con guiones', () => {
    const b = libro(
      [
        ['', '', '', '', '', '', ''],
        ['', 'Título', 'Licencia', 'ISBN', 'Fecha generación', 'Caducidad', 'Tipo usuario'],
        ['', '', '', '', '', '', ''],
        ['', 'Libro de prueba Nivel I', 'MNCW-TCK3-H3CU-B8QD', '9788469636510', '9/16/26', '9/3/27', 'Alumno'],
        ['', 'Libro de prueba Nivel I', '4ZTN-F587-GMJS-9KH7', '9788469636510', '9/16/26', '9/3/27', 'Alumno'],
      ],
      'Licencia',
    );
    const r = analizarExcel(b);
    expect(r.columnaSugerida).toBe(2);
    expect(r.codigos).toEqual(['MNCW-TCK3-H3CU-B8QD', '4ZTN-F587-GMJS-9KH7']);
  });

  it('se puede forzar otra columna cuando el formato es nuevo y adivina mal', () => {
    const b = libro([
      ["Referencia", "Clau d'accés"],
      ['REF-00001', 'S3E49B88'],
      ['REF-00002', 'Z6K6H7H8'],
    ]);
    // Cabecera en un idioma que no está en la lista: se descarta igual, porque debajo hay
    // códigos de verdad. Eso es lo que evita mandarle a un alumno la palabra "Clau d'accés".
    expect(analizarExcel(b, { columna: 1 }).codigos).toEqual(['S3E49B88', 'Z6K6H7H8']);
    // Forzando una columna que no son códigos, sale tal cual (incluida su cabecera): ahí el
    // que avisa es la vista previa, no el adivinador.
    expect(analizarExcel(b, { columna: 0 }).codigos).toEqual(['Referencia', 'REF-00001', 'REF-00002']);
  });

  it('un ISBN de 13 dígitos nunca gana a la columna de códigos', () => {
    const b = libro([
      ['ISBN', 'Code'],
      ['9788490369340', 'XQXN1YG7'],
      ['9788490369340', 'TK3QN5D7'],
    ]);
    expect(analizarExcel(b).codigos).toEqual(['XQXN1YG7', 'TK3QN5D7']);
  });

  it('un fichero vacío no revienta', () => {
    expect(analizarExcel(libro([])).codigos).toEqual([]);
  });
});
