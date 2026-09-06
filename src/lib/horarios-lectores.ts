// Lectores de ficheros de horarios: convierten un .docx o un .xlsx en las CUADRÍCULAS DE
// TEXTO que come `horarios-import.ts`. Ficha: docs/07-horarios.md
//
// La separación es a propósito: aquí vive todo lo que sabe de formatos (zip, XML de Word,
// hojas de cálculo) y nada de horarios; en `horarios-import.ts` vive todo lo que sabe de
// horarios y nada de formatos. Cuando llegue la API de Educamos será un lector más y el
// normalizador no se toca.
//
// Ni el .docx necesita dependencias nuevas: SheetJS (que ya está en el proyecto para los
// excels) trae un lector de contenedores ZIP en `XLSX.CFB`, y un .docx es un ZIP con el
// XML dentro. Se comprobó con el fichero real del colegio.

import * as XLSX from 'xlsx';

export type Cuadricula = string[][];

export interface BloqueLeido {
  /** 'clase' | 'profe' — qué clase de horario es, según la cabecera del bloque. */
  tipo: 'clase' | 'profe';
  /** El título tal cual ('1PRIA: 1º EP-A' o 'ALEJANDRO SÁNCHEZ GIL'). */
  titulo: string;
  filas: Cuadricula;
}

// ─── .docx ────────────────────────────────────────────────────────────────────

interface Nodo {
  tag: string;
  hijos: Nodo[];
  texto: string; // solo para nodos de texto sintéticos
}

const AUTOCERRADOS = /\/>$/;

/**
 * Árbol mínimo del XML de Word. No es un parser de XML general: solo necesita anidamiento
 * correcto de `w:tbl`/`w:tr`/`w:tc`/`w:p`, y texto de `w:t` con los saltos de `w:br`.
 * Se hace a mano porque en Node no hay DOMParser y meter una dependencia de XML para
 * leer un fichero al año no compensa.
 */
function arbolWord(xml: string): Nodo {
  const raiz: Nodo = { tag: '#root', hijos: [], texto: '' };
  const pila: Nodo[] = [raiz];
  const re = /<([^>]+)>([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const bruto = m[1];
    const suelto = m[2];
    const cierra = bruto.startsWith('/');
    const nombre = bruto.replace(/^\//, '').split(/[\s/>]/)[0];
    const actual = pila[pila.length - 1];

    if (cierra) {
      if (pila.length > 1) pila.pop();
    } else if (nombre === 'w:br' || nombre === 'w:cr') {
      actual.hijos.push({ tag: '#texto', hijos: [], texto: '\n' });
    } else if (!AUTOCERRADOS.test(`<${bruto}>`)) {
      const nodo: Nodo = { tag: nombre, hijos: [], texto: '' };
      actual.hijos.push(nodo);
      pila.push(nodo);
    }
    // El texto que va justo detrás de una etiqueta solo cuenta dentro de <w:t>.
    const dentro = pila[pila.length - 1];
    if (suelto && dentro.tag === 'w:t') dentro.hijos.push({ tag: '#texto', hijos: [], texto: desescapar(suelto) });
  }
  return raiz;
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function textoDe(n: Nodo): string {
  if (n.tag === '#texto') return n.texto;
  return n.hijos.map(textoDe).join('');
}

/** Hijos directos con un tag concreto (no nietos: importa para tablas anidadas). */
function directos(n: Nodo, tag: string): Nodo[] {
  return n.hijos.filter((h) => h.tag === tag);
}

function textoParrafo(p: Nodo): string {
  return textoDe(p).trim();
}

/** Texto de una celda: solo sus párrafos DIRECTOS, para no tragarse tablas anidadas. */
function textoCelda(tc: Nodo): string {
  return directos(tc, 'w:p').map(textoParrafo).filter(Boolean).join('\n');
}

function cuadriculaDe(tbl: Nodo): Cuadricula {
  return directos(tbl, 'w:tr').map((tr) => directos(tr, 'w:tc').map(textoCelda));
}

function tieneDias(g: Cuadricula): boolean {
  return g.some((f) => f.some((c) => c.trim().toLowerCase() === 'lunes'));
}

const RE_TITULO_CLASE = /^\d\s*[ºO]?\s*(INF|PRI|ESO|BACH|CFGM|CFGS|PPDC|PDC)[A-Z]?\s*:\s*\S/i;
const RE_CABECERA = /^HORARIO DE (CLASE|PROFESOR)/i;

/**
 * Bloques de un .docx de horarios de Educamos.
 *
 * Un bloque es: el párrafo del título, LA PRIMERA cuadrícula que le sigue, y los párrafos
 * de leyenda hasta el siguiente título o la siguiente cabecera "HORARIO DE …". Lo de "la
 * primera" no es un detalle: el documento trae los 18 horarios de clase y detrás los ~31
 * de profesor, y sin ese corte el último bloque de clase se traga todos los demás.
 */
export function leerDocx(datos: ArrayBuffer | Uint8Array): BloqueLeido[] {
  const cfb = XLSX.CFB.read(datos instanceof Uint8Array ? datos : new Uint8Array(datos), { type: 'buffer' });
  const entrada = XLSX.CFB.find(cfb, '/word/document.xml');
  if (!entrada?.content) throw new Error('El .docx no contiene word/document.xml: ¿seguro que es un Word?');
  const xml = Buffer.from(entrada.content as Uint8Array).toString('utf8');
  const raiz = arbolWord(xml);

  const bloques: BloqueLeido[] = [];
  let actual: (BloqueLeido & { conCuadricula: boolean }) | null = null;
  let cabecera: 'clase' | 'profe' = 'clase';

  // Recorrido en orden de documento (el padre antes que sus hijos), igual que Word lo pinta.
  const visitar = (n: Nodo): void => {
    if (n.tag === 'w:p') {
      const t = textoParrafo(n);
      if (t) {
        const cab = RE_CABECERA.exec(t);
        if (cab) {
          cabecera = cab[1].toUpperCase() === 'CLASE' ? 'clase' : 'profe';
          actual = null;
        } else if (RE_TITULO_CLASE.test(t) && cabecera === 'clase') {
          actual = { tipo: 'clase', titulo: t, filas: [[t]], conCuadricula: false };
          bloques.push(actual);
        } else if (actual) {
          actual.filas.push([t]);
        }
      }
      return; // los hijos de un párrafo ya están en su texto
    }
    if (n.tag === 'w:tbl') {
      const g = cuadriculaDe(n);
      if (tieneDias(g)) {
        if (!actual) return;
        if (actual.conCuadricula) { actual = null; return; }
        actual.filas.push(...g);
        actual.conCuadricula = true;
        return; // la cuadrícula ya está leída: no hace falta bajar a sus celdas
      }
    }
    for (const h of n.hijos) visitar(h);
  };
  visitar(raiz);

  return bloques.filter((b) => (b as BloqueLeido & { conCuadricula: boolean }).conCuadricula).map(({ tipo, titulo, filas }) => ({ tipo, titulo, filas }));
}

// ─── .xlsx ────────────────────────────────────────────────────────────────────

/**
 * Bloques de un .xlsx de horarios de Educamos: una hoja por bloque (clase o profe), que es
 * como los saca. Cada hoja se vuelca a texto con `sheet_to_json({header:1})`, que respeta
 * filas y columnas vacías si se le pide `defval`.
 */
export function leerXlsx(datos: ArrayBuffer | Uint8Array): BloqueLeido[] {
  const wb = XLSX.read(datos, { type: 'array' });
  const bloques: BloqueLeido[] = [];
  for (const nombre of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, defval: '', blankrows: true });
    const cuadricula: Cuadricula = filas.map((f) => (f ?? []).map((c) => (c == null ? '' : String(c))));
    if (!tieneDias(cuadricula)) continue;
    const plano = cuadricula.flat().map((c) => c.trim()).filter(Boolean);
    const esProfe = plano.some((t) => /^HORARIO DE PROFESOR/i.test(t));
    const titulo = plano.find((t) => RE_TITULO_CLASE.test(t)) ?? plano.find((t) => !/^(colegio|horario de|horas)/i.test(t)) ?? nombre;
    bloques.push({ tipo: esProfe ? 'profe' : 'clase', titulo, filas: cuadricula });
  }
  return bloques;
}

/** Elige el lector por la firma del fichero, no por la extensión (que a veces miente). */
export function leerHorarios(datos: ArrayBuffer | Uint8Array, nombreFichero = ''): BloqueLeido[] {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // 'PK' — lo son tanto .docx como .xlsx
  if (!esZip) throw new Error('El fichero no es un .docx ni un .xlsx (no empieza por PK)');
  const pareceDocx = /\.docx$/i.test(nombreFichero);
  if (pareceDocx) return leerDocx(bytes);
  try {
    return leerXlsx(bytes);
  } catch {
    return leerDocx(bytes);
  }
}
