import { google } from 'googleapis';

// Sincronización con el Google Sheet histórico (pestañas "SI/NO BdL - FORM26"), para poder
// usar el sistema nuevo y el antiguo (GAS) en paralelo. Solo escribimos los datos del pedido
// (identidad + licencias); las columnas de estado Q🧾/R📤/S💰 y sus fechas compañeras (Z, AA)
// NUNCA se tocan aquí — esas las gestiona quien las esté usando en cada momento (esta app o el
// propio Google Sheet/GAS), para no pisar el trabajo manual del otro sistema.

// Layout de columnas de "SI BdL - FORM26" / "NO BdL - FORM26" (A → AD, 30 columnas):
// A Marca temporal · B Email · C Apellidos · D Nombre · E Año nacimiento · F Curso
// G-N Selección de licencias por curso (formulario antiguo, ya no se usa: la dejamos vacía)
// O Columna 1 (campo del formulario antiguo sin uso conocido: la dejamos vacía)
// P Codigo alumno (clave para localizar/actualizar la fila)
// Q🧾 / R📤 / S💰 · estado — en filas EXISTENTES no se tocan nunca; en filas NUEVAS se
// inicializan a FALSE (checkbox sin marcar), que es su estado de partida real.
// T Apellido · U Nombre · V Correo · W Nacimiento · X Curso · Y Licencias (códigos)
// Z Fecha petición licencias (la escribe el informe de editoriales) · AA Fecha informe de pago — NO TOCAR
// AB Fecha rellenó el form (valor real, lo escribimos siempre)
// AC Letra · AD Línea (idioma) — en la fila 2 son fórmulas (VLOOKUP contra BBDD Alumnos);
// en vez de escribir un valor estático, copiamos esas fórmulas fila a fila (como un
// copiar/pegar normal de Sheets, con las referencias ajustándose solas)

export interface SheetOrderRow {
  studentCode: string;
  apellidos: string;
  nombre: string;
  birthYear: number | null;
  curso: string;
  email: string;
  codigos: string[];
  letra: string | null;
  lengua: string | null;
  confirmedAt: Date | null;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Faltan GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY en el entorno');
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error('Falta GOOGLE_SHEETS_SPREADSHEET_ID en el entorno');
  return id;
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleString('es-ES') : '';
}

// A..P (16 valores) — datos "de identidad" del pedido, sin tocar Q/R/S
function rowAtoP(r: SheetOrderRow): (string | number)[] {
  return [
    fmtDate(r.confirmedAt), // A Marca temporal
    r.email, // B Email
    r.apellidos, // C Apellidos
    r.nombre, // D Nombre
    r.birthYear ?? '', // E Año nacimiento
    r.curso, // F Curso
    '', '', '', '', '', '', '', '', // G-N (formulario antiguo, sin usar)
    '', // O (sin uso conocido)
    r.studentCode, // P Codigo
  ];
}

// T..Y (6 valores)
function rowTtoY(r: SheetOrderRow): (string | number)[] {
  return [r.apellidos, r.nombre, r.email, r.birthYear ?? '', r.curso, r.codigos.join(', ')];
}

// AB (1 valor) — Fecha rellenó el form. AC/AD no se tocan en filas existentes (son fórmulas).
function rowAB(r: SheetOrderRow): (string | number)[] {
  return [fmtDate(r.confirmedAt)];
}

// Fila completa (30 valores, A..AD) para alta de fila nueva.
// Q/R/S = FALSE (checkbox sin marcar, no vacío). Z/AA en blanco (sin procesar aún).
// AC/AD se dejan vacíos aquí: se rellenan después copiando la fórmula de la fila 2
// (ver copyFormulaColumns), no como texto estático.
function rowFull(r: SheetOrderRow): (string | number | boolean)[] {
  return [...rowAtoP(r), false, false, false, ...rowTtoY(r), '', '', ...rowAB(r), '', ''];
}

// ── Libros: lee la pestaña "BBDD Libros" (A COD · B Editorial · C Curso · D Lengua ·
// E Asignatura · F Proyecto-Nombre Libro · G ISBN · H Banco Libros · I Precio · J Texto Formulario)
export interface SheetBookRow {
  cod: string;
  editorial: string;
  curso: string;
  lengua: string;
  asignatura: string;
  nombreLibro: string;
  isbn: string;
  bancoLibros: boolean;
  precio: string;
  textoFormulario: string;
}

function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return String(v ?? '').trim().toUpperCase() === 'TRUE';
}

// Los números de Sheets llegan como float de JS (ej. ISBN 9788490369296) o como string "23.95".
function cellToString(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v ?? '').trim();
}

export async function getBooksFromSheet(): Promise<SheetBookRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "'BBDD Libros'!A2:J",
  });
  const rows = res.data.values ?? [];

  return rows
    .filter((r) => cellToString(r[0])) // sin código, sin libro
    .map((r) => ({
      cod: cellToString(r[0]),
      editorial: cellToString(r[1]),
      curso: cellToString(r[2]),
      lengua: cellToString(r[3]),
      asignatura: cellToString(r[4]),
      nombreLibro: cellToString(r[5]),
      isbn: cellToString(r[6]),
      bancoLibros: truthy(r[7]),
      precio: cellToString(r[8]).replace(',', '.'),
      textoFormulario: cellToString(r[9]),
    }));
}

// ── Alumnos: lee la pestaña "BBDD Alumnos".
// OJO: la fila de cabeceras (fila 2) NO coincide con las columnas reales de datos a partir
// de la I — verificado leyendo filas reales del Sheet. La cabecera dice I=Nombre, J=Mail,
// K=Banco Libros, L=Lengua Base, M=ID Educamos, pero los datos reales son:
//   I = nombre completo calculado (apellidos + nombre) → no lo usamos, es redundante
//   J = Nombre (real)      K = Mail (real)      L = Banco Libros (real, TRUE/FALSE)
//   M = Lengua Base (real) N = ID Educamos (vacío en todas las filas actuales)
// Usamos los índices verificados contra datos reales, no los literales de la cabecera.
export interface SheetStudentRow {
  studentCode: string;
  curso: string;
  letra: string | null;
  birthYear: number | null;
  apellidos: string;
  apellido1: string | null;
  apellido2: string | null;
  nombre: string;
  email: string | null;
  bancoLibros: boolean;
  lenguaBase: string | null;
  educamosId: string | null;
}

// (getStudentsFromSheet se retiró: el alumnado de Licencias se puebla desde la BBDD
// central edu_students, ver licencias-server.getStudentsFromCentral)
export interface SyncResult {
  tab: string;
  updated: number;
  appended: number;
}

async function getSheetIdByTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === title)?.properties?.sheetId;
  if (sheetId == null) throw new Error(`No se encontró la pestaña "${title}" en el Sheet`);
  return sheetId;
}

// Copia las fórmulas de AC2:AD2 a AC{startRow}:AD{startRow+count-1}, igual que un
// copiar/pegar normal de Sheets (las referencias relativas se ajustan solas por fila).
async function copyFormulaColumns(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetId: number,
  startRow: number,
  count: number,
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 28, endColumnIndex: 30 }, // AC2:AD2
            destination: {
              sheetId,
              startRowIndex: startRow - 1,
              endRowIndex: startRow - 1 + count,
              startColumnIndex: 28,
              endColumnIndex: 30,
            },
            pasteType: 'PASTE_FORMULA',
          },
        },
      ],
    },
  });
}

// Upsert por código de alumno (columna P). Actualiza en sitio si ya existe la fila,
// añade al final si no. En filas existentes nunca se escribe en Q, R, S, Z, AA, AC ni AD.
export async function syncOrdersToSheet(tab: string, rows: SheetOrderRow[]): Promise<SyncResult> {
  if (rows.length === 0) return { tab, updated: 0, appended: 0 };

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = getSpreadsheetId();

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!P2:P`,
  });
  const codeToRow = new Map<string, number>();
  (existing.data.values ?? []).forEach((v, i) => {
    const code = String(v[0] ?? '').trim();
    if (code) codeToRow.set(code, i + 2); // +2: la data empieza en la fila 2
  });

  const updateData: { range: string; values: (string | number)[][] }[] = [];
  const toAppend: (string | number | boolean)[][] = [];

  for (const r of rows) {
    const rowNum = codeToRow.get(r.studentCode);
    if (rowNum) {
      updateData.push({ range: `'${tab}'!A${rowNum}:P${rowNum}`, values: [rowAtoP(r)] });
      updateData.push({ range: `'${tab}'!T${rowNum}:Y${rowNum}`, values: [rowTtoY(r)] });
      updateData.push({ range: `'${tab}'!AB${rowNum}:AB${rowNum}`, values: [rowAB(r)] });
    } else {
      toAppend.push(rowFull(r));
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updateData },
    });
  }
  if (toAppend.length > 0) {
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A1:AD1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: toAppend },
    });
    const updatedRange = appendRes.data.updates?.updatedRange ?? '';
    const startRow = Number(updatedRange.match(/![A-Z]+(\d+):/)?.[1]);
    if (startRow) {
      const sheetId = await getSheetIdByTitle(sheets, spreadsheetId, tab);
      await copyFormulaColumns(sheets, spreadsheetId, sheetId, startRow, toAppend.length);
    }
  }

  return { tab, updated: updateData.length / 3, appended: toAppend.length };
}
