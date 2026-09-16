// El pedido a una editorial **sale de la plantilla del colegio**, no de un fichero hecho aquí:
// se copia el Google Sheet «# Plantilla Pedido Licencias» y se escriben los datos dentro. Así
// el pedido conserva su formato (PT Sans, la cabecera, los anchos, el congelado, el autofiltro
// y los formatos de número) sin tener que reproducirlo a mano, y si algún día se retoca la
// plantilla, los pedidos salen retocados sin tocar código.
import { google } from 'googleapis';
import { credenciales } from '@/lib/cuaderno/drive';
import type { EditorialReportRow } from '@/lib/licencias-server';

export type TipoPedido = 'pago' | 'banco';

/** La plantilla de la que se parte. Configurable por si se cambia de fichero. */
export const PLANTILLA_POR_DEFECTO = '1NTvTtOkD7gE3wtMf8p1y-Hn0gO9abAAvFjioXA9Cm98';

export function plantillaPedido(): string {
  return process.env.LICENCIAS_PLANTILLA_PEDIDO?.trim() || PLANTILLA_POR_DEFECTO;
}

export function nombreFichero(campaña: string, editorial: string, tipo: TipoPedido): string {
  const limpio = (editorial || 'Sin editorial').replace(/[\\/:*?"<>[\]]/g, ' ').trim();
  return `Pedido ${campaña} · ${limpio} · ${tipo === 'banco' ? 'BANCO DE LIBROS' : 'PAGO'}`;
}

/** Nombre de la pestaña dentro del pedido. Sheets corta en 100; de sobra. */
export function nombrePestana(editorial: string, tipo: TipoPedido): string {
  return `${editorial || 'Sin editorial'} · ${tipo === 'banco' ? 'Banco de libros' : 'Pago'}`;
}

/** Precio en número; el catálogo lo guarda como texto y a veces con coma decimal. */
export function precioNumero(precio: string | null | undefined): number {
  const n = parseFloat(String(precio ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function importeTotal(filas: EditorialReportRow[]): number {
  return filas.reduce((s, r) => s + precioNumero(r.precio) * r.unidades, 0);
}

export function totalUnidades(filas: EditorialReportRow[]): number {
  return filas.reduce((s, r) => s + r.unidades, 0);
}

/** Agrupa las filas del informe por editorial, en orden alfabético. */
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

/**
 * Las diez columnas de la plantilla, en su orden: A COD · B Editorial · C ISBN · D UDs ·
 * E Curso · F Asignatura · G Proyecto - Nombre Libro · H Banco Libros · I Precio ·
 * J Fecha informe editorial.
 *
 * El ISBN va como **texto**: en número, Sheets redondea los trece dígitos a notación científica
 * y se pierde el último (en el pedido de agosto de 2025 se ve el estropicio).
 */
function filaDatos(r: EditorialReportRow, tipo: TipoPedido, sello: string): (string | number)[] {
  return [
    r.cod,
    r.editorial,
    r.isbn,
    r.unidades,
    r.curso,
    r.asignatura,
    r.nombreLibro,
    tipo === 'banco' ? 'Sí' : r.bancoLibros ? 'Sí' : 'No',
    precioNumero(r.precio),
    sello,
  ];
}

function getSheets() {
  const cred = credenciales();
  if (!cred) throw new Error('Faltan las credenciales de Google');
  const auth = new google.auth.JWT({
    email: cred.clientEmail,
    key: cred.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Generar ocho pedidos son muchas llamadas seguidas y Sheets contesta 403 «User rate limit
 * exceeded» —no 429— cuando se le va la mano. Sin esto, el último pedido de la tanda se
 * quedaba sin generar (le pasó a SM en la primera prueba).
 */
async function conReintentos<T>(operacion: () => Promise<T>, intentos = 5): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await operacion();
    } catch (error) {
      ultimo = error;
      const e = error as { code?: number; status?: number; message?: string };
      const codigo = e?.code ?? e?.status;
      const porCuota =
        codigo === 429 ||
        (codigo === 403 && /rate limit|quota/i.test(e?.message ?? '')) ||
        (typeof codigo === 'number' && codigo >= 500);
      if (!porCuota || i === intentos - 1) throw error;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  throw ultimo;
}

/** Sello de la columna J, con la misma pinta que ponía el script del Excel: `✅ 25-08-11 18:26`. */
export function selloFecha(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `✅ ${dos(fecha.getFullYear() % 100)}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/**
 * Escribe el pedido dentro de una copia de la plantilla.
 *
 * El formato de las filas de datos se **arrastra desde la fila 2** de la plantilla (que ya lo
 * lleva puesto) con un copiar/pegar de solo formato, en vez de darlo celda a celda: así lo que
 * mande sea siempre la plantilla. Por eso también hay que ampliar la cuadrícula antes, que la
 * plantilla viene con 15 filas y un pedido del banco puede tener 27 libros.
 */
export async function escribirPedidoEnCopia(
  spreadsheetId: string,
  filas: EditorialReportRow[],
  tipo: TipoPedido,
  editorial: string,
  fecha = new Date(),
): Promise<void> {
  const sheets = getSheets();
  const meta = await conReintentos(() => sheets.spreadsheets.get({ spreadsheetId }));
  const hoja = meta.data.sheets?.[0]?.properties;
  const sheetId = hoja?.sheetId;
  if (sheetId == null) throw new Error('La copia de la plantilla no tiene ninguna pestaña');

  const filasNecesarias = filas.length + 2; // cabecera + datos + total
  const filasActuales = hoja?.gridProperties?.rowCount ?? 0;

  const peticiones: object[] = [
    { updateSheetProperties: { properties: { sheetId, title: nombrePestana(editorial, tipo) }, fields: 'title' } },
  ];
  if (filasActuales < filasNecesarias) {
    peticiones.push({
      appendDimension: { sheetId, dimension: 'ROWS', length: filasNecesarias - filasActuales },
    });
  }
  // Formato de la fila 2 → todas las filas de datos.
  if (filas.length > 1) {
    peticiones.push({
      copyPaste: {
        source: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 },
        destination: { sheetId, startRowIndex: 2, endRowIndex: filas.length + 1, startColumnIndex: 0, endColumnIndex: 10 },
        pasteType: 'PASTE_FORMAT',
      },
    });
  }
  // La plantilla trae filas de ejemplo con restos (un `FALSE` suelto en la última): se vacía
  // todo lo que haya bajo la cabecera antes de escribir, o se quedan colgando al final.
  peticiones.push({
    updateCells: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
      fields: 'userEnteredValue',
    },
  });
  await conReintentos(() => sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: peticiones } }));

  const sello = selloFecha(fecha);
  const datos = filas.map((r) => filaDatos(r, tipo, sello));

  // Fila de total: SOLO las unidades. La plantilla del colegio no lleva total de importe.
  const filaTotal = filas.length + 2;
  const total: (string | number)[] = ['TOTAL', '', '', `=SUM(D2:D${filas.length + 1})`, '', '', '', '', '', ''];

  await conReintentos(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `A2:J${filas.length + 1}`, values: datos },
          { range: `A${filaTotal}:J${filaTotal}`, values: [total] },
        ],
      },
    }),
  );

  // La fila de total, en negrita y sin heredar el amarillo de la columna A de los datos.
  await conReintentos(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: filaTotal - 1,
                endRowIndex: filaTotal,
                startColumnIndex: 0,
                endColumnIndex: 10,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
        ],
      },
    }),
  );
}
