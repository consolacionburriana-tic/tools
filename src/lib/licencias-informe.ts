import type { EditorialReportRow } from '@/lib/licencias-server';

// Formato común de los dos informes de editoriales (de pago y del banco de libros), para que
// lleguen a la editorial con las mismas columnas y se puedan pegar en la misma hoja.
export const INFORME_HEADER = [
  'Código',
  'Editorial',
  'ISBN',
  'UDs',
  'Curso',
  'Asignatura',
  'Nombre del libro',
  'Banco de libros',
  'Precio',
  'Fecha',
];

export function informeCsvRows(rows: EditorialReportRow[], fecha = new Date().toLocaleString('es-ES')) {
  return rows.map((r) => [
    r.cod,
    r.editorial,
    r.isbn,
    r.unidades,
    r.curso,
    r.asignatura,
    r.nombreLibro,
    r.bancoLibros ? 'Sí' : 'No',
    r.precio,
    fecha,
  ]);
}
