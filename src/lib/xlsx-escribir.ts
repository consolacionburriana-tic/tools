// Escritor de .xlsx **con estilos**. Puro (salvo el zip final) y sin dependencias nuevas:
// entra un modelo de libro y sale el buffer del fichero.
//
// Por qué a mano y no con SheetJS, que ya está en el repo: la versión community de `xlsx`
// escribe datos, anchos y paneles, pero **no** rellenos, tipografías ni colores de pestaña,
// que es justo lo que hace que la lista de clase se parezca a la de David. Y por qué no la
// API de Sheets: no está habilitada en el proyecto de la cuenta de servicio (`tools-…`), y
// aunque lo estuviera harían falta N llamadas de formato por hoja. Con esto es un único
// `files.create` a Drive con conversión — el mismo truco que el cuaderno usa con .docx →
// Google Doc (ver `src/lib/cuaderno/ooxml.ts`).
//
// Lo que sabe hacer, que es lo que hace falta y ni una cosa más:
//   · texto, número, fecha (`dd/mm/yyyy`), booleano y fórmula
//   · una tipografía por celda (familia, negrita, color) y un relleno de fondo
//   · alineado horizontal/vertical, anchos de columna, columnas ocultas, alto de la fila 1
//   · panel congelado, autofiltro y color de pestaña
//
// Testeado en `src/lib/__tests__/xlsx-escribir.test.ts`.
import JSZip from 'jszip';

export type ValorCelda = string | number | boolean | Date | null | undefined;

export interface EstiloCelda {
  /** Familia tipográfica; por defecto la del libro (`fuente`). */
  fuente?: string;
  tamano?: number;
  negrita?: boolean;
  /** Color del texto en `RRGGBB`. */
  color?: string;
  /** Relleno sólido en `RRGGBB`. */
  fondo?: string;
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'center' | 'bottom';
  ajustarTexto?: boolean;
  /** Formato numérico literal (`dd/mm/yyyy`, `0.00`…). Las fechas ya traen el suyo. */
  formato?: string;
}

export interface Celda {
  valor?: ValorCelda;
  /** Fórmula sin el `=` inicial (`CONCATENATE(C2," ",D2)`). Manda sobre `valor`. */
  formula?: string;
  estilo?: EstiloCelda;
}

/** Una celda puede darse pelada (el valor) o con su estilo. */
export type EntradaCelda = ValorCelda | Celda;

export interface Columna {
  /** Ancho en caracteres, como el de Excel/Sheets (el de la lista de clase va de 4 a 34). */
  ancho?: number;
  oculta?: boolean;
}

export interface Hoja {
  /** Nombre de la pestaña. Se limpia con `nombreDeHoja` al escribir. */
  nombre: string;
  filas: EntradaCelda[][];
  columnas?: Columna[];
  /** Color de la pestaña en `RRGGBB`. */
  colorPestana?: string;
  /** Celda superior izquierda del panel desplazable: `'A2'` congela la fila 1. */
  congelar?: string;
  /** `true` = autofiltro sobre todo lo escrito; o un rango literal (`'A1:R30'`). */
  autofiltro?: boolean | string;
  /** Alto de la fila 1, en puntos. */
  altoCabecera?: number;
}

export interface Libro {
  hojas: Hoja[];
  /** Tipografía por defecto de todo el libro. */
  fuente?: string;
  tamano?: number;
}

// ─── XML ──────────────────────────────────────────────────────────────────────

// Los caracteres de control no son XML 1.0 válido: Excel abre el fichero igual, pero Drive
// rechaza la conversión con un 400 que no dice por qué. Fuera antes de escribir.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escaparXml(texto: string): string {
  return texto
    .replace(CONTROL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `0` → `A`, `25` → `Z`, `26` → `AA`. */
export function letraColumna(indice: number): string {
  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

export const referencia = (fila: number, columna: number) => `${letraColumna(columna)}${fila + 1}`;

/**
 * Nombre de pestaña válido: Excel prohíbe `: \ / ? * [ ]` y corta en 31 caracteres.
 * Sheets es más permisivo, pero el fichero que se sube es un .xlsx.
 */
export function nombreDeHoja(nombre: string): string {
  const limpio = nombre.replace(/[:\\/?*[\]]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (limpio || 'Hoja').slice(0, 31);
}

/** Nombres únicos dentro del libro: `1ºA`, `1ºA (2)`… Excel no abre un libro con repes. */
export function nombresUnicos(nombres: readonly string[]): string[] {
  const vistos = new Set<string>();
  return nombres.map((n) => {
    const base = nombreDeHoja(n);
    if (!vistos.has(base)) {
      vistos.add(base);
      return base;
    }
    for (let i = 2; ; i++) {
      const sufijo = ` (${i})`;
      const candidato = base.slice(0, 31 - sufijo.length) + sufijo;
      if (!vistos.has(candidato)) {
        vistos.add(candidato);
        return candidato;
      }
    }
  });
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

const EPOCA = Date.UTC(1899, 11, 30); // el "día 0" de Excel, con el bug del 1900 ya dentro
const MS_POR_DIA = 86_400_000;

/**
 * Fecha → número de serie de Excel. Se toman **los componentes locales** de la fecha: un
 * `2013-01-29` guardado como medianoche UTC no puede acabar siendo el 28 en la lista.
 */
export function fechaASerie(fecha: Date): number {
  const utc = Date.UTC(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    fecha.getHours(),
    fecha.getMinutes(),
    fecha.getSeconds(),
  );
  return (utc - EPOCA) / MS_POR_DIA;
}

// ─── Catálogo de estilos ──────────────────────────────────────────────────────

const FORMATO_FECHA = 'dd/mm/yyyy';

interface Catalogo {
  fuentes: string[];
  rellenos: string[];
  formatos: string[];
  estilos: string[];
  /** Clave serializada del estilo → índice en `estilos` (`cellXfs`). */
  indices: Map<string, number>;
}

export function nuevoCatalogo(fuenteBase = 'Arial', tamanoBase = 10): Catalogo {
  return {
    fuentes: [`<font><sz val="${tamanoBase}"/><color theme="1"/><name val="${escaparXml(fuenteBase)}"/></font>`],
    // Los dos primeros rellenos son obligatorios y en este orden: Excel los da por hechos.
    rellenos: ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'],
    formatos: [],
    estilos: ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'],
    indices: new Map([['', 0]]),
  };
}

const rgb = (color: string) => `FF${color.replace('#', '').toUpperCase()}`;

/**
 * Índice del estilo (creándolo si es nuevo). El deduplicado importa: sin él, 30 filas × 18
 * columnas son 540 entradas idénticas en `styles.xml`.
 */
function idEstilo(catalogo: Catalogo, estilo: EstiloCelda | undefined, formatoImplicito?: string): number {
  const formato = estilo?.formato ?? formatoImplicito;
  if (!estilo && !formato) return 0;
  const clave = JSON.stringify([
    estilo?.fuente ?? '',
    estilo?.tamano ?? 0,
    estilo?.negrita ?? false,
    estilo?.color ?? '',
    estilo?.fondo ?? '',
    estilo?.horizontal ?? '',
    estilo?.vertical ?? '',
    estilo?.ajustarTexto ?? false,
    formato ?? '',
  ]);
  const ya = catalogo.indices.get(clave);
  if (ya !== undefined) return ya;

  let fontId = 0;
  if (estilo && (estilo.fuente || estilo.tamano || estilo.negrita || estilo.color)) {
    const partes = [
      estilo.negrita ? '<b/>' : '',
      estilo.tamano ? `<sz val="${estilo.tamano}"/>` : '',
      estilo.color ? `<color rgb="${rgb(estilo.color)}"/>` : '<color theme="1"/>',
      estilo.fuente ? `<name val="${escaparXml(estilo.fuente)}"/>` : '',
    ].join('');
    fontId = catalogo.fuentes.push(`<font>${partes}</font>`) - 1;
  }

  let fillId = 0;
  if (estilo?.fondo) {
    const color = rgb(estilo.fondo);
    fillId =
      catalogo.rellenos.push(
        `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor rgb="${color}"/></patternFill></fill>`,
      ) - 1;
  }

  let numFmtId = 0;
  if (formato) {
    // Los formatos propios empiezan en 164 por convención de la especificación.
    const existente = catalogo.formatos.indexOf(formato);
    numFmtId = 164 + (existente >= 0 ? existente : catalogo.formatos.push(formato) - 1);
  }

  const alineado =
    estilo && (estilo.horizontal || estilo.vertical || estilo.ajustarTexto)
      ? `<alignment${estilo.horizontal ? ` horizontal="${estilo.horizontal}"` : ''}${
          estilo.vertical ? ` vertical="${estilo.vertical}"` : ''
        }${estilo.ajustarTexto ? ' wrapText="1"' : ''}/>`
      : '';
  const xf =
    `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"` +
    `${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}` +
    `${fillId ? ' applyFill="1"' : ''}${alineado ? ' applyAlignment="1"' : ''}>` +
    `${alineado}</xf>`;
  const id = catalogo.estilos.push(xf) - 1;
  catalogo.indices.set(clave, id);
  return id;
}

function stylesXml(catalogo: Catalogo): string {
  const formatos = catalogo.formatos
    .map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escaparXml(f)}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${
    formatos ? `<numFmts count="${catalogo.formatos.length}">${formatos}</numFmts>` : ''
  }<fonts count="${catalogo.fuentes.length}">${catalogo.fuentes.join('')}</fonts><fills count="${
    catalogo.rellenos.length
  }">${catalogo.rellenos.join(
    '',
  )}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${
    catalogo.estilos.length
  }">${catalogo.estilos.join(
    '',
  )}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// ─── Hojas ────────────────────────────────────────────────────────────────────

const esCelda = (entrada: EntradaCelda): entrada is Celda =>
  typeof entrada === 'object' &&
  entrada !== null &&
  !(entrada instanceof Date) &&
  ('valor' in entrada || 'formula' in entrada || 'estilo' in entrada);

function celdaXml(ref: string, entrada: EntradaCelda, catalogo: Catalogo): string {
  const celda: Celda = esCelda(entrada) ? entrada : { valor: entrada };
  const { valor, formula, estilo } = celda;
  const implicito = valor instanceof Date ? FORMATO_FECHA : undefined;
  const s = idEstilo(catalogo, estilo, implicito);
  const attrS = s ? ` s="${s}"` : '';

  if (formula) return `<c r="${ref}"${attrS}><f>${escaparXml(formula)}</f></c>`;
  if (valor === null || valor === undefined || valor === '') {
    // Una celda vacía CON estilo sí hay que escribirla (la cabecera de una columna sin
    // título, p. ej.); sin estilo, no ocupa sitio.
    return s ? `<c r="${ref}"${attrS}/>` : '';
  }
  if (valor instanceof Date) return `<c r="${ref}"${attrS}><v>${fechaASerie(valor)}</v></c>`;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? `<c r="${ref}"${attrS}><v>${valor}</v></c>` : '';
  }
  if (typeof valor === 'boolean') return `<c r="${ref}"${attrS} t="b"><v>${valor ? 1 : 0}</v></c>`;
  // `t="inlineStr"`: sin tabla de cadenas compartidas. Un poco más grande, mucho más simple,
  // y Drive lo convierte igual.
  return `<c r="${ref}"${attrS} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

/** `'B2'` → `{ x: 1, y: 1 }`; null si no es una referencia. */
function coordenadas(ref: string): { x: number; y: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  const x = m[1].split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { x, y: Number(m[2]) - 1 };
}

export function hojaXml(hoja: Hoja, catalogo: Catalogo): string {
  const filas = hoja.filas;
  const anchoMax = filas.reduce((max, f) => Math.max(max, f.length), hoja.columnas?.length ?? 0);
  const rangoCompleto = filas.length > 0 && anchoMax > 0 ? `A1:${referencia(filas.length - 1, anchoMax - 1)}` : 'A1';

  const cols = (hoja.columnas ?? [])
    .map((c, i) =>
      c.ancho || c.oculta
        ? `<col min="${i + 1}" max="${i + 1}"${c.ancho ? ` width="${c.ancho}" customWidth="1"` : ''}${
            c.oculta ? ' hidden="1"' : ''
          }/>`
        : '',
    )
    .join('');

  const cuerpo = filas
    .map((fila, i) => {
      const celdas = fila.map((celda, j) => celdaXml(referencia(i, j), celda, catalogo)).join('');
      const alto = i === 0 && hoja.altoCabecera ? ` ht="${hoja.altoCabecera}" customHeight="1"` : '';
      return `<row r="${i + 1}"${alto}>${celdas}</row>`;
    })
    .join('');

  const punto = hoja.congelar ? coordenadas(hoja.congelar) : null;
  const congelar =
    punto && (punto.x > 0 || punto.y > 0)
      ? `<pane${punto.x > 0 ? ` xSplit="${punto.x}"` : ''}${punto.y > 0 ? ` ySplit="${punto.y}"` : ''} topLeftCell="${
          hoja.congelar!.toUpperCase()
        }" activePane="${punto.x > 0 && punto.y > 0 ? 'bottomRight' : punto.x > 0 ? 'topRight' : 'bottomLeft'}" state="frozen"/>`
      : '';

  const filtro =
    hoja.autofiltro === true
      ? filas.length > 0 && anchoMax > 0
        ? `<autoFilter ref="${rangoCompleto}"/>`
        : ''
      : typeof hoja.autofiltro === 'string'
        ? `<autoFilter ref="${escaparXml(hoja.autofiltro)}"/>`
        : '';

  // `sheetPr` va ANTES que `dimension`: el orden de los hijos de `<worksheet>` es parte del
  // esquema, y Drive rechaza el fichero si se altera.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${
    hoja.colorPestana ? `<sheetPr><tabColor rgb="${rgb(hoja.colorPestana)}"/></sheetPr>` : ''
  }<dimension ref="${rangoCompleto}"/><sheetViews><sheetView workbookViewId="0">${congelar}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${
    cols ? `<cols>${cols}</cols>` : ''
  }<sheetData>${cuerpo}</sheetData>${filtro}</worksheet>`;
}

// ─── Libro ────────────────────────────────────────────────────────────────────

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Construye el .xlsx completo. Es la única función con IO (el zip) de todo el fichero. */
export async function escribirXlsx(libro: Libro): Promise<Buffer> {
  if (libro.hojas.length === 0) throw new Error('Un libro necesita al menos una hoja');
  const catalogo = nuevoCatalogo(libro.fuente ?? 'Arial', libro.tamano ?? 10);
  const nombres = nombresUnicos(libro.hojas.map((h) => h.nombre));
  // El XML de las hojas se genera ANTES que `styles.xml`: es al recorrer las celdas cuando
  // se llena el catálogo de estilos.
  const hojas = libro.hojas.map((hoja) => hojaXml(hoja, catalogo));

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${
            i + 1
          }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join(
        '',
      )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres
      .map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
            i + 1
          }.xml"/>`,
      )
      .join(
        '',
      )}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  hojas.forEach((xml, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml));
  zip.file('xl/styles.xml', stylesXml(catalogo));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
