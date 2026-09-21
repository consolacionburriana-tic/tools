// Pegado y emparejado de códigos de activación (Fase 5 de docs/11-licencias-v2.md).
//
// El flujo real es: llegan los códigos de la editorial en un Excel «de su padre y de su madre»,
// David filtra en pantalla el libro y el curso que le acaban de mandar, copia la columna de
// códigos del Excel y la pega aquí. La app empareja **en el orden en que se ven las filas**,
// enseña la vista previa y dice si faltan o si sobran.
//
// Todo lo de este fichero es puro (sin IO) para que se pueda probar: es la pieza donde un fallo
// silencioso significa mandarle a una familia el código de otra.

/** Cada editorial tiene su formato; no se valida contra una lista cerrada, solo se reconoce. */
const FORMAS_CODIGO: RegExp[] = [
  /^[A-Z0-9]{6,10}$/, //            Cambridge (XQXN1YG7) · Bromera (S3E49B88)
  /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2,3}$/, // Anaya (CGJC-CDAF-S9S4-UWRR)
  /^[A-Z0-9]{5}(-[A-Z0-9]{5}){1,2}$/, // SM (D6F2W-1W1SM-AJGXD)
  /^[0-9a-f]{8,12}$/, //            Edebé (8354033acd) — minúsculas a propósito
];

/** Un ISBN no es un código de licencia, y las dos columnas suelen ir pegadas en el mismo Excel. */
export function pareceIsbn(valor: string): boolean {
  const limpio = valor.replace(/[\s-]/g, '');
  return /^\d{10}$|^\d{13}$/.test(limpio);
}

/**
 * ¿Esto tiene pinta de un código de activación? Se usa para elegir la columna del pegado o del
 * Excel, no para rechazar nada: un código que no encaje en ninguna forma se acepta igual si es
 * lo que el usuario ha elegido pegar.
 */
export function pareceCodigo(valor: string): boolean {
  const v = valor.trim();
  if (v.length < 6 || v.length > 40) return false;
  if (pareceIsbn(v)) return false;
  if (/\s/.test(v)) return false;
  return FORMAS_CODIGO.some((r) => r.test(v)) || FORMAS_CODIGO.some((r) => r.test(v.toUpperCase()));
}

/**
 * Normaliza un código tal y como llega: Excel mete espacios de relleno y saltos raros, y un
 * espacio invisible al final es media hora buscando por qué la editorial dice que no existe.
 * NO se toca la caja: los de Edebé son minúsculas de verdad.
 */
export function limpiarCodigo(valor: string): string {
  return valor.replace(/[ ​]/g, ' ').trim();
}

const CABECERAS = [
  'licencia',
  'licencia activacion',
  'codigo',
  'código',
  'code',
  'codigo de activacion',
  'clave',
  'licence',
  'license',
  'activation code',
];

/** ¿La primera fila del pegado es la cabecera que se ha copiado sin querer? */
export function esCabecera(valor: string): boolean {
  const v = valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  return CABECERAS.some((c) => v === c || v.startsWith(c));
}

export interface PegadoAnalizado {
  /** Filas × columnas tal cual venían (para el selector de columna). */
  columnas: string[][];
  /** Índice de la columna que más pinta tiene de códigos. */
  columnaSugerida: number;
  /** Los códigos ya limpios de la columna sugerida, sin vacíos ni cabecera. */
  codigos: string[];
}

/**
 * Parte el texto pegado en filas y columnas. Excel copia con tabuladores, así que si alguien
 * copia dos columnas (el título y la licencia) llegan las dos y hay que poder elegir cuál es.
 */
export function analizarPegado(texto: string): PegadoAnalizado {
  const filas = (texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.split('\t').map(limpiarCodigo))
    .filter((cells) => cells.some((c) => c !== ''));
  if (filas.length === 0) return { columnas: [], columnaSugerida: 0, codigos: [] };
  const ancho = Math.max(...filas.map((f) => f.length));
  const columnas = filas.map((f) => Array.from({ length: ancho }, (_, i) => f[i] ?? ''));
  const columnaSugerida = elegirColumna(columnas);
  return { columnas, columnaSugerida, codigos: codigosDeColumna(columnas, columnaSugerida) };
}

/**
 * Elige la columna con más valores con pinta de código. En empate gana la de más a la
 * izquierda; si ninguna columna convence (formato nuevo de una editorial), gana la que tenga
 * más valores distintos, que es lo que caracteriza a una lista de códigos frente a una de
 * títulos o ISBN repetidos.
 */
export function elegirColumna(filas: string[][]): number {
  const ancho = filas[0]?.length ?? 0;
  let mejor = 0;
  let mejorPuntos = -1;
  for (let c = 0; c < ancho; c++) {
    const valores = filas.map((f) => f[c]).filter((v) => v !== '' && !esCabecera(v));
    if (valores.length === 0) continue;
    const conPinta = valores.filter(pareceCodigo).length;
    const distintos = new Set(valores).size;
    // El ratio de "pinta de código" manda; la unicidad solo desempata (×1000 para que no pese).
    const puntos = (conPinta / valores.length) * 1_000_000 + (distintos / valores.length) * 1000 + valores.length;
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = c;
    }
  }
  return mejor;
}

/**
 * Los valores de una columna, ya sin vacíos ni cabecera. Además de las cabeceras conocidas se
 * descarta el **primer** valor cuando no tiene pinta de código y el resto sí: al forzar una
 * columna a mano (formato nuevo de una editorial) la cabecera se llama como le dé la gana
 * («Referencia», «Clau d'accés»), y colarla como código le da a un alumno una licencia falsa.
 */
export function codigosDeColumna(filas: string[][], columna: number): string[] {
  const valores = filas.map((f) => f[columna] ?? '').filter((v) => v !== '' && !esCabecera(v));
  if (valores.length < 2) return valores;
  const [primero, ...resto] = valores;
  const conPinta = resto.filter(pareceCodigo).length;
  return !pareceCodigo(primero) && conPinta >= resto.length / 2 ? resto : valores;
}

export interface DuplicadoPegado {
  codigo: string;
  veces: number;
}

/** Códigos repetidos dentro del propio pegado: casi siempre es una selección de más en Excel. */
export function duplicadosEn(codigos: string[]): DuplicadoPegado[] {
  const cuenta = new Map<string, number>();
  for (const c of codigos) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  return [...cuenta.entries()].filter(([, n]) => n > 1).map(([codigo, veces]) => ({ codigo, veces }));
}

export interface Hueco {
  id: string;
  alumno: string;
  curso: string;
}

export interface Emparejamiento<H extends Hueco> {
  /** Parejas hueco ← código, en el orden en que se ven en pantalla. */
  parejas: { hueco: H; codigo: string }[];
  /** Huecos que se quedan sin código (faltan licencias). */
  sinCodigo: H[];
  /** Códigos que se quedan sin hueco: van al almacén de sobrantes. */
  sobrantes: string[];
}

/**
 * Empareja en orden. **El orden lo manda quien llama** (la tabla de la pantalla), no el
 * servidor: si el servidor volviera a ordenar por su cuenta, la vista previa que ha aprobado
 * David y lo que se guarda podrían no ser lo mismo.
 */
export function emparejar<H extends Hueco>(huecos: H[], codigos: string[]): Emparejamiento<H> {
  const n = Math.min(huecos.length, codigos.length);
  return {
    parejas: huecos.slice(0, n).map((hueco, i) => ({ hueco, codigo: codigos[i] })),
    sinCodigo: huecos.slice(n),
    sobrantes: codigos.slice(n),
  };
}
