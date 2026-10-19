// Licencias del profesorado (Fase 5b de docs/11-licencias-v2.md). Helpers puros, sin IO: el
// análisis del pegado, los conflictos con lo ya anotado y el texto del correo.
//
// Se usan MUY poco —unas pocas por curso, mucho menos que las del alumnado—, así que el flujo
// es el más corto posible: «pego los códigos, pam, este para este profe, este para este».
import { analizarPegado, duplicadosEn, type DuplicadoPegado } from '@/lib/licencias-codigos';

export interface LicenciaProfeFila {
  id: string;
  eduTeacherId: string | null;
  /** Nombre visible del profe (`nombreProfe`), o '' si aún no tiene dueño. */
  profe: string;
  email: string | null;
  libro: string;
  codigo: string;
  nota: string | null;
  enviadoAt: string | null;
  enviadoA: string | null;
  createdAt: string;
}

export interface ProfeOpcion {
  id: string;
  nombre: string;
  email: string | null;
  /** Texto normalizado para el buscador del selector. */
  busca: string;
}

/** Minúsculas y sin acentos: «josé» encuentra a «José» y a «JOSE». */
export function normalizarBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Los profes cuyo nombre o correo contiene TODAS las palabras tecleadas, en cualquier orden. */
export function filtrarProfes(profes: readonly ProfeOpcion[], termino: string): ProfeOpcion[] {
  const palabras = normalizarBusqueda(termino).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...profes];
  return profes.filter((p) => palabras.every((w) => p.busca.includes(w)));
}

export interface PegadoProfes {
  /** Códigos únicos, en el orden en que se pegaron. */
  codigos: string[];
  /** Los que venían repetidos en el propio pegado (se quedan una sola vez). */
  repetidos: DuplicadoPegado[];
}

/**
 * Lo pegado → códigos. Se reutiliza `analizarPegado` del envío al alumnado: si se copian dos
 * columnas del Excel (título y licencia) elige sola la de los códigos y salta la cabecera. Aquí
 * un repetido no bloquea, como en el alumnado: son tres códigos, se dice y se quita.
 */
export function analizarPegadoProfes(texto: string): PegadoProfes {
  const { codigos } = analizarPegado(texto);
  return { codigos: [...new Set(codigos)], repetidos: duplicadosEn(codigos) };
}

export interface ConflictoCodigo {
  codigo: string;
  /** Dónde está ya: «de Lucía Pérez (1ºESO)», «en el almacén de sobrantes», «de Carlos Valero». */
  donde: string;
}

/**
 * Separa lo que se puede anotar de lo que ya está en algún sitio de la campaña. **No se pisa
 * nada**: un código que ya es de un alumno, está en el almacén o ya se anotó a un profe se
 * devuelve como conflicto y se dice dónde está.
 */
export function separarConflictos(
  codigos: readonly string[],
  yaUsados: ReadonlyMap<string, string>,
): { nuevos: string[]; conflictos: ConflictoCodigo[] } {
  const nuevos: string[] = [];
  const conflictos: ConflictoCodigo[] = [];
  for (const codigo of codigos) {
    const donde = yaUsados.get(codigo);
    if (donde) conflictos.push({ codigo, donde });
    else nuevos.push(codigo);
  }
  return { nuevos, conflictos };
}

/** Asunto del correo al profe. Con libro, lo dice; sin él, genérico. */
export function asuntoLicenciaProfe(libro: string | null | undefined): string {
  const l = (libro ?? '').trim();
  return l ? `[Licencia Digital 📘] Licencia ${l}` : '[Licencia Digital 📘] Tu licencia digital';
}

/**
 * Cuerpo del correo al profe, en el formato de `htmlLicencia` (admite `<b>` y `{codigo}`, que
 * se convierte en la caja grande). Es el texto de las del alumnado con el saludo por su nombre.
 */
export function cuerpoLicenciaProfe(pila: string, libro: string | null | undefined): string {
  const l = (libro ?? '').trim();
  return `Hola${pila ? ` ${pila}` : ''},

Te mandamos ${l ? `la licencia de <b>${l}</b>` : 'tu licencia digital'}.

⬇️ <b>CÓDIGO LICENCIA</b> ⬇️
{codigo}

Cualquier duda, nos dices.

Equipo TIC`;
}
