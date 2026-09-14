// Retoques que SOLO se pueden hacer con la API de Sheets, una vez el xlsx ya está subido y
// convertido a hoja nativa. Hoy solo hay uno: los **chips de la columna «Tutor»**.
//
// Por qué un segundo paso y no viene ya en el xlsx: un chip no es formato, es un objeto vivo
// de Google que el formato OOXML no sabe representar. El xlsx sigue siendo la fuente de la
// hoja entera y esto es una pasada final de una sola llamada por archivo.
//
// ── Por qué un desplegable y no un chip de persona ────────────────────────────
// Un chip de persona (`chipRuns` + `personProperties`) también funciona —se escribe poniendo
// `'@'` como carácter placeholder en la celda y el `chipRun` encima, con `startIndex: 0`—
// pero enseña el nombre **como lo tenga el directorio de Workspace**: «María Teresa Tomás
// Gil». `displayFormat` solo admite `DEFAULT`, así que no hay forma de pedirle el nombre de
// pila a secas, que es lo que se quiere en la lista.
//
// El chip de desplegable (validación de datos `ONE_OF_LIST` con `showCustomUi`) sí: la celda
// dice «María» y se pinta como píldora. Y además se le puede **poner color a mano** desde
// Datos › Validación de datos, opción por opción, que con el chip de persona no se puede.
// Ficha: docs/18-cuaderno-tutor.md
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import { credenciales } from '@/lib/cuaderno/drive';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cliente: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (cliente) return cliente;
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  const auth = new google.auth.JWT({ email: cred.clientEmail, key: cred.privateKey, scopes: SCOPES });
  cliente = google.sheets({ version: 'v4', auth });
  return cliente;
}

export interface DesplegableDeHoja {
  /** Nombre de la pestaña, tal cual se llamó al crear el libro («1º ESO B»). */
  hoja: string;
  /** Índice de la columna (0 = A) que lleva el desplegable. */
  columna: number;
  /** Fila de la primera celda con datos (0 = la 1 de la hoja; con cabecera, 1). */
  primeraFila: number;
  /** Cuántas filas de datos tiene la clase. */
  filas: number;
  /** Las opciones del desplegable: los nombres de pila de los tutores de esa clase. */
  opciones: readonly string[];
}

/**
 * Pone el desplegable de la columna «Tutor» en cada pestaña. Devuelve cuántas hojas retocó.
 *
 * Todo en un único `batchUpdate` (una hoja = una petición dentro del lote): el rango va
 * entero de una vez, no celda a celda.
 *
 * `strict: false` a propósito: si un tutor cambia a mitad de curso y alguien escribe un
 * nombre que no está en la lista, Sheets lo marca con una esquinita y sigue, en vez de
 * plantarse y no dejar escribir. Es una lista de clase, no un formulario.
 *
 * No lanza si una pestaña no aparece en el libro: se la salta.
 */
export async function ponerDesplegableDeTutor(
  spreadsheetId: string,
  hojas: readonly DesplegableDeHoja[],
): Promise<number> {
  const utiles = hojas.filter((h) => h.filas > 0 && h.opciones.length > 0);
  if (utiles.length === 0) return 0;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const idsPorNombre = new Map(
    (meta.data.sheets ?? []).map((h) => [h.properties?.title ?? '', h.properties?.sheetId ?? -1]),
  );

  const requests: sheets_v4.Schema$Request[] = [];
  for (const hoja of utiles) {
    const sheetId = idsPorNombre.get(hoja.hoja);
    if (sheetId === undefined || sheetId < 0) continue;
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: hoja.primeraFila,
          endRowIndex: hoja.primeraFila + hoja.filas,
          startColumnIndex: hoja.columna,
          endColumnIndex: hoja.columna + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: hoja.opciones.map((v) => ({ userEnteredValue: v })),
          },
          // `showCustomUi` es lo que convierte el desplegable en píldora en vez de en un
          // triangulito: sin esto no hay chip, solo una flechita al lado de la celda.
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  if (requests.length === 0) return 0;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  return requests.length;
}
