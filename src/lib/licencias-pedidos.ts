// Construye el .xlsx de un pedido a una editorial. Se sube a Drive convirtiéndolo a Google
// Sheet (`subirComoGoogleSheet`), así que lo que ve la editorial es una hoja nativa.
//
// Las columnas son las de la plantilla que usa el colegio («# Plantilla Pedido Licencias»),
// en su orden y con sus nombres: el pedido que se manda tiene que parecerse al del año pasado.
import type { EditorialReportRow } from '@/lib/licencias-server';
import { escribirXlsx, type Hoja } from '@/lib/xlsx-escribir';

export type TipoPedido = 'pago' | 'banco';

export const CABECERAS = [
  'COD',
  'Editorial',
  'ISBN',
  'UDs',
  'Curso',
  'Asignatura',
  'Proyecto - Nombre Libro',
  'Banco Libros',
  'Precio',
  'Fecha informe editorial',
] as const;

const ANCHOS = [14, 13, 18, 7, 9, 30, 30, 13, 10, 22];

const AZUL = '1D4ED8';
const GRIS = 'F1F5F9';

export function nombreFichero(campaña: string, editorial: string, tipo: TipoPedido): string {
  const limpio = (editorial || 'Sin editorial').replace(/[\\/:*?"<>[\]]/g, ' ').trim();
  return `Pedido ${campaña} · ${limpio} · ${tipo === 'banco' ? 'BANCO DE LIBROS' : 'PAGO'}`;
}

/** Precio en número; el catálogo lo guarda como texto y a veces con coma decimal. */
export function precioNumero(precio: string | null | undefined): number {
  const n = parseFloat(String(precio ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function importeTotal(filas: EditorialReportRow[]): number {
  return filas.reduce((s, r) => s + precioNumero(r.precio) * r.unidades, 0);
}

/**
 * El ISBN va como TEXTO a propósito: son 13 dígitos y, en número, Sheets los redondea a
 * notación científica y se pierde el último. En el pedido del año pasado se ve el estropicio
 * (`9788490369296` guardado como número).
 */
export function hojaPedido(filas: EditorialReportRow[], tipo: TipoPedido, fecha: Date): Hoja {
  const cabecera = { negrita: true, color: 'FFFFFF', fondo: AZUL, vertical: 'center' as const };
  const sello = fecha.toLocaleDateString('es-ES');

  const cuerpo = filas.map((r) => [
    r.cod,
    r.editorial,
    { valor: r.isbn, estilo: { horizontal: 'left' as const } },
    r.unidades,
    r.curso,
    r.asignatura,
    r.nombreLibro,
    tipo === 'banco' ? 'Sí' : r.bancoLibros ? 'Sí' : 'No',
    { valor: precioNumero(r.precio), estilo: { formato: '0.00' } },
    sello,
  ]);

  const total = [
    { valor: 'TOTAL', estilo: { negrita: true, fondo: GRIS } },
    { valor: '', estilo: { fondo: GRIS } },
    { valor: '', estilo: { fondo: GRIS } },
    { valor: filas.reduce((s, r) => s + r.unidades, 0), estilo: { negrita: true, fondo: GRIS } },
    ...Array.from({ length: 4 }, () => ({ valor: '', estilo: { fondo: GRIS } })),
    { valor: 'Importe', estilo: { negrita: true, fondo: GRIS, horizontal: 'right' as const } },
    { valor: importeTotal(filas), estilo: { negrita: true, fondo: GRIS, formato: '0.00' } },
  ];

  return {
    nombre: tipo === 'banco' ? 'Banco de libros' : 'Pedido',
    filas: [CABECERAS.map((c) => ({ valor: c, estilo: cabecera })), ...cuerpo, total],
    columnas: ANCHOS.map((ancho) => ({ ancho })),
    congelar: 'A2',
    autofiltro: true,
    altoCabecera: 26,
    colorPestana: tipo === 'banco' ? '059669' : AZUL,
  };
}

export async function xlsxPedido(
  filas: EditorialReportRow[],
  tipo: TipoPedido,
  fecha = new Date(),
): Promise<Buffer> {
  return escribirXlsx({ hojas: [hojaPedido(filas, tipo, fecha)], fuente: 'Arial', tamano: 10 });
}

/** Agrupa las filas del informe por editorial, en orden alfabético y sin editoriales vacías. */
export function porEditorial(filas: EditorialReportRow[]): { editorial: string; filas: EditorialReportRow[] }[] {
  const grupos = new Map<string, EditorialReportRow[]>();
  for (const r of filas) {
    const e = r.editorial || 'Sin editorial';
    const arr = grupos.get(e) ?? [];
    arr.push(r);
    grupos.set(e, arr);
  }
  return [...grupos.entries()]
    .map(([editorial, filas]) => ({ editorial, filas }))
    .sort((a, b) => a.editorial.localeCompare(b.editorial, 'es'));
}
