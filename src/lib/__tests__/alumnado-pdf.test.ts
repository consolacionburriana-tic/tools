import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pdfProteccion, type AlumnoPdf } from '@/lib/alumnado-pdf';

/** Alumnado inventado con la forma del real (nombres largos, acentos, Ñ y huecos). */
const alumnos: AlumnoPdf[] = [
  { etapa: 'EI', clase: '3º INF A', curso: '3INF', letra: 'A' },
  { etapa: 'EP', clase: '1º EP A', curso: '1EP', letra: 'A' },
  { etapa: 'ESO', clase: '4º ESO B', curso: '4ESO', letra: 'B' },
].flatMap((clase) =>
  Array.from({ length: 25 }, (_, i) => ({
    ...clase,
    numero: i + 1,
    completo: `Begoña Martínez-Peñalver Ñíguez de la Concepción ${i + 1}`,
    proteccion: { imagen: i % 7 === 0 ? false : i % 5 === 0 ? null : true, prodat: i % 3 === 0 ? null : true },
  })),
);

/** Se vuelve a abrir el PDF para contar hojas: si se pudiera abrir, es que salió bien. */
const paginas = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('PDF de protección de datos', () => {
  it('sale un PDF de verdad, con varias páginas y sin romperse por los acentos', async () => {
    const bytes = await pdfProteccion(alumnos, { ambito: 'Todo el centro', filtro: 'todos', porEtapa: false });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(await paginas(bytes)).toBeGreaterThan(1);
  });

  it('«por etapas» abre hoja nueva en cada etapa, así que ocupa más que seguido', async () => {
    const seguido = await pdfProteccion(alumnos, { ambito: 'Todo el centro', filtro: 'todos', porEtapa: false });
    const porEtapa = await pdfProteccion(alumnos, { ambito: 'Todo el centro', filtro: 'todos', porEtapa: true });
    expect(await paginas(porEtapa)).toBeGreaterThanOrEqual(await paginas(seguido));
    expect(await paginas(porEtapa)).toBeGreaterThanOrEqual(3);
  });

  it('una lista vacía no revienta: sale una hoja que lo dice', async () => {
    const bytes = await pdfProteccion([], { ambito: 'Infantil', filtro: 'sin-fotos', porEtapa: false });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(await paginas(bytes)).toBe(1);
  });
});
