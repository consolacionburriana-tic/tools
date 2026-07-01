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
// Q🧾 / R📤 / S💰 · estado — NO TOCAR
// T Apellido · U Nombre · V Correo · W Nacimiento · X Curso · Y Licencias (códigos)
// Z Fecha petición licencias (la escribe el informe de editoriales) · AA Fecha informe de pago — NO TOCAR
// AB Fecha rellenó el form · AC Letra · AD Línea (idioma)

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

// AB..AD (3 valores)
function rowABtoAD(r: SheetOrderRow): (string | number)[] {
  return [fmtDate(r.confirmedAt), r.letra ?? '', r.lengua ?? ''];
}

// Fila completa (30 valores, A..AD) para alta de fila nueva — aquí sí dejamos Q/R/S/Z/AA
// en blanco porque la fila no existía: no hay nada que "pisar".
function rowFull(r: SheetOrderRow): (string | number)[] {
  return [...rowAtoP(r), '', '', '', ...rowTtoY(r), '', '', ...rowABtoAD(r)];
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

export interface SyncResult {
  tab: string;
  updated: number;
  appended: number;
}

// Upsert por código de alumno (columna P). Actualiza en sitio si ya existe la fila,
// añade al final si no. Nunca escribe en Q, R, S, Z ni AA.
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
  const toAppend: (string | number)[][] = [];

  for (const r of rows) {
    const rowNum = codeToRow.get(r.studentCode);
    if (rowNum) {
      updateData.push({ range: `'${tab}'!A${rowNum}:P${rowNum}`, values: [rowAtoP(r)] });
      updateData.push({ range: `'${tab}'!T${rowNum}:Y${rowNum}`, values: [rowTtoY(r)] });
      updateData.push({ range: `'${tab}'!AB${rowNum}:AD${rowNum}`, values: [rowABtoAD(r)] });
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
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A1:AD1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: toAppend },
    });
  }

  return { tab, updated: updateData.length / 3, appended: toAppend.length };
}
