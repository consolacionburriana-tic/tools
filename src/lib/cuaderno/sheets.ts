// Retoques que SOLO se pueden hacer con la API de Sheets, una vez el xlsx ya está subido y
// convertido a hoja nativa. Hoy solo hay uno: los **chips de persona** de la columna «Tutor».
//
// Por qué un segundo paso y no viene ya en el xlsx: un chip de persona no es formato, es un
// objeto vivo de Google (foto, correo, tarjeta al pasar el ratón) que el formato OOXML no
// sabe representar. Así que el xlsx sigue siendo la fuente de la hoja entera y esto es una
// pasada final de una sola llamada por archivo.
//
// Cómo se escribe un chip (comprobado contra la API el 14-sep-2026, porque la documentación
// no lo dice con estas palabras):
//   · el `stringValue` de la celda tiene que ser un **carácter placeholder**: `'@'`.
//   · el `chipRun` va con `startIndex: 0` apuntando a ese `@`.
//   · la API sustituye sola el placeholder por el correo y deja el `chipRun` encima; la hoja
//     pinta el chip con el nombre del directorio.
// Errores que da si te sales de ahí: sin texto, «Can only set chip runs on non-computed,
// non-empty string values»; con el correo como texto, «The chip run start index must be a
// placeholder character» (y si cuela, el correo sale además duplicado detrás del chip).
//
// `displayFormat` solo admite `DEFAULT`: no hay forma de pedirle al chip que enseñe únicamente
// el nombre de pila, lo enseña como lo tenga el directorio de Workspace. Es el precio del chip
// frente al texto plano; queda apuntado en docs/18-cuaderno-tutor.md.
// Ficha: docs/18-cuaderno-tutor.md
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import { credenciales } from '@/lib/cuaderno/drive';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** El carácter que la API exige en la celda para poder colgarle un chip encima. */
const PLACEHOLDER = '@';

let cliente: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (cliente) return cliente;
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  const auth = new google.auth.JWT({ email: cred.clientEmail, key: cred.privateKey, scopes: SCOPES });
  cliente = google.sheets({ version: 'v4', auth });
  return cliente;
}

export interface ChipsDeHoja {
  /** Nombre de la pestaña, tal cual se llamó al crear el libro («1º ESO B»). */
  hoja: string;
  /** Índice de la columna (0 = A) donde van los chips. */
  columna: number;
  /** Fila de la primera celda con datos (0 = la 1 de la hoja; con cabecera, 1). */
  primeraFila: number;
  /** Un correo por fila, en el mismo orden que las filas de la hoja. `null` = celda en blanco. */
  correos: readonly (string | null)[];
}

/**
 * Convierte en chips de persona las celdas indicadas. Devuelve cuántas escribió.
 *
 * Se manda todo en un único `batchUpdate` (una celda = una petición dentro del lote): son 25
 * filas por clase, no hay ningún motivo para ir de una en una. Las filas sin correo se dejan
 * como están: el texto que ya venía del xlsx —vacío cuando falta el reparto de tutorías— es
 * mejor que un chip roto.
 *
 * No lanza si una pestaña no aparece en el libro: se la salta. Que el chip decorativo tumbe
 * la generación de la lista entera sería absurdo.
 */
export async function ponerChipsDePersona(spreadsheetId: string, hojas: readonly ChipsDeHoja[]): Promise<number> {
  const conCorreos = hojas.filter((h) => h.correos.some(Boolean));
  if (conCorreos.length === 0) return 0;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const idsPorNombre = new Map(
    (meta.data.sheets ?? []).map((h) => [h.properties?.title ?? '', h.properties?.sheetId ?? -1]),
  );

  const requests: sheets_v4.Schema$Request[] = [];
  for (const hoja of conCorreos) {
    const sheetId = idsPorNombre.get(hoja.hoja);
    if (sheetId === undefined || sheetId < 0) continue;
    hoja.correos.forEach((email, i) => {
      if (!email) return;
      const fila = hoja.primeraFila + i;
      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: fila,
            endRowIndex: fila + 1,
            startColumnIndex: hoja.columna,
            endColumnIndex: hoja.columna + 1,
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: PLACEHOLDER },
                  chipRuns: [{ startIndex: 0, chip: { personProperties: { email, displayFormat: 'DEFAULT' } } }],
                },
              ],
            },
          ],
          fields: 'userEnteredValue,chipRuns',
        },
      });
    });
  }

  if (requests.length === 0) return 0;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  return requests.length;
}
