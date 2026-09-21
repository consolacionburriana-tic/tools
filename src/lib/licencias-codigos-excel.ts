// Lectura del Excel que manda la editorial. Vive aparte de `licencias-codigos.ts` porque
// importa SheetJS y ese fichero se usa también en el navegador.
//
// «cada excel es de su padre y de su madre, no hay manera» (David). Es verdad, pero los tres
// reales que hemos visto se parecen en lo único que importa: hay UNA columna de códigos y
// todo lo demás es relleno. Así que no se reconoce a la editorial, se busca la columna:
//
//   · Cambridge  → 11 filas de preámbulo, cabecera `ISBN | Book | Code | User | …`
//   · SM         → cabecera en la fila 0, `Nombre Producto | Licencias Alumno | … | ISBN`
//   · Anaya/Edebé→ columna A vacía, cabecera en la fila 1, `Título | Licencia | ISBN | …`
//
// Si llega un formato nuevo y la columna elegida no es la buena, la pantalla deja cambiarla a
// mano: esto adivina, no decide.
import * as XLSX from 'xlsx';
import { codigosDeColumna, elegirColumna, limpiarCodigo } from '@/lib/licencias-codigos';

export interface ExcelAnalizado {
  hoja: string;
  hojas: string[];
  /** Filas no vacías, ya recortadas (para el selector de columna y la vista previa). */
  filas: string[][];
  columnaSugerida: number;
  codigos: string[];
  cabecera: string[] | null;
}

/** Lee la hoja indicada (o la primera) y devuelve sus filas no vacías como texto. */
export function filasDeExcel(datos: ArrayBuffer | Buffer, hojaPedida?: string): { hoja: string; hojas: string[]; filas: string[][] } {
  const wb = XLSX.read(Buffer.isBuffer(datos) ? datos : Buffer.from(new Uint8Array(datos)), { type: 'buffer' });
  const hojas = wb.SheetNames;
  const hoja = hojaPedida && hojas.includes(hojaPedida) ? hojaPedida : hojas[0];
  const ws = wb.Sheets[hoja];
  if (!ws) return { hoja: hoja ?? '', hojas, filas: [] };
  // `raw: false` para que los ISBN y los códigos numéricos lleguen como texto y no en
  // notación científica (el mismo estropicio que ya nos comió un dígito en los pedidos).
  const crudas = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
  const filas = crudas
    .map((f) => (Array.isArray(f) ? f.map((c) => limpiarCodigo(String(c ?? ''))) : []))
    .filter((f) => f.some((c) => c !== ''));
  const ancho = Math.max(0, ...filas.map((f) => f.length));
  return { hoja, hojas, filas: filas.map((f) => Array.from({ length: ancho }, (_, i) => f[i] ?? '')) };
}

/**
 * Del fichero a la lista de códigos. Descarta el preámbulo (Cambridge mete seis filas de
 * metadatos antes de la cabecera) quedándose solo con las filas que tienen valor en la columna
 * elegida — que es justo lo que hace `codigosDeColumna`.
 */
export function analizarExcel(datos: ArrayBuffer | Buffer, opciones: { hoja?: string; columna?: number } = {}): ExcelAnalizado {
  const { hoja, hojas, filas } = filasDeExcel(datos, opciones.hoja);
  if (filas.length === 0) {
    return { hoja, hojas, filas: [], columnaSugerida: 0, codigos: [], cabecera: null };
  }
  const columnaSugerida = opciones.columna ?? elegirColumna(filas);
  return {
    hoja,
    hojas,
    filas,
    columnaSugerida,
    codigos: codigosDeColumna(filas, columnaSugerida),
    cabecera: filas[0] ?? null,
  };
}
