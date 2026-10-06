// Evaluaciones → Classroom · helpers puros (sin IO). Ficha: docs/16-evaluaciones.md
//
// La evaluación se publica en la tutoría de cada clase como TAREA (con fecha límite y «marcar
// como hecha») o como ANUNCIO, desde una cuenta que sea profe de esas clases. Aquí vive lo que se
// puede probar sin Google: casar «1ESO B» con la clase de Classroom que es su tutoría y montar
// el texto.
import { AUDIENCIAS, claseLabel } from '@/lib/evaluaciones';
import { cursoEnNombre } from '@/lib/calendarios';

export type TipoPublicacion = 'tarea' | 'anuncio';

export interface ClaseDeForm {
  curso: string;
  letra: string | null;
}

/** Una clase de Classroom de la que la cuenta publicadora es profe. */
export interface ClaseClassroomMin {
  id: string;
  nombre: string | null;
  /** La «sección» de Classroom: muchas tutorías se llaman solo «Tutoría» y el curso va aquí («2ESOB (2026/2027)»). */
  seccion?: string | null;
  enlace: string | null;
}

/** Mayúsculas, sin acentos, sin º/°/ª y sin nada que no sea letra o número: «1º ESO B» → «1ESOB». */
export function compactar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ºª°]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * ¿El nombre de esa clase de Classroom dice esta clase? Se compara «compactado», así que
 * «1ESOA (2026/2027)», «Tutoría 1º ESO A» y «1 ESO-A» valen igual. Dos cuidados:
 *  - lo anterior no puede ser un dígito (`1ESOA` no es `11ESOA`);
 *  - lo siguiente no puede ser una LETRA si la clase no tiene letra (`1ESO` no es `1ESOA`), ni
 *    cuando la tiene (`1ESOA` no es `1ESOAB`); los dígitos del año que vienen detrás sí valen.
 */
export function nombreDiceClase(nombre: string | null | undefined, clase: ClaseDeForm): boolean {
  const n = compactar(nombre);
  const clave = compactar(clase.curso) + (clase.letra && clase.letra !== 'PDC' ? compactar(clase.letra) : '');
  if (!clave) return false;
  let desde = 0;
  for (;;) {
    const i = n.indexOf(clave, desde);
    if (i < 0) return false;
    const antes = n[i - 1];
    const despues = n[i + clave.length];
    if (!(antes && /\d/.test(antes)) && !(despues && /[A-Z]/.test(despues))) return true;
    desde = i + 1;
  }
}

export interface EmparejamientoClase {
  clase: ClaseDeForm;
  etiqueta: string;
  /** La clase de Classroom elegida: la fijada a mano o, si no, la única candidata clara. */
  destino: ClaseClassroomMin | null;
  /** De dónde sale el destino: lo dijo alguien (`manual`) o se dedujo del nombre (`auto`). */
  origen: 'manual' | 'auto' | null;
  /**
   * Por qué no hay destino: ninguna candidata, varias sin desempate, o una fijada a mano que
   * ya no está entre las clases activas de la cuenta (la archivaron, o ya no es profe).
   */
  motivo: 'sin-clase' | 'ambigua' | 'fijada-sin-acceso' | null;
  /** Las candidatas cuando es ambigua, para enseñarlas. */
  candidatas: ClaseClassroomMin[];
}

/** Clave de una clase del cole para guardar su tutoría fijada a mano. */
export function claveClase(c: ClaseDeForm): string {
  return `${c.curso}|${c.letra ?? ''}`;
}

/**
 * Casa cada clase del formulario con su tutoría entre las clases de Classroom de la cuenta
 * publicadora. Reglas, en este orden:
 *  0. Si alguien la fijó a mano (`fijados`: clave de clase → courseId), manda eso. Si esa clase
 *     ya no está entre las de la cuenta, NO se vuelve a deducir por el nombre: se dice.
 *  1. Si el nombre dice un curso escolar, tiene que ser el de la evaluación (las de años
 *     pasados que sigan activas no cuentan).
 *  2. Si queda más de una, gana la que dice «tutoría» en el nombre.
 *  3. Si aun así hay varias, es ambigua: no se publica en ninguna y se enseña el motivo.
 */
export function emparejarClases(
  clases: readonly ClaseDeForm[],
  deClassroom: readonly ClaseClassroomMin[],
  academicYear: string,
  fijados: ReadonlyMap<string, string> = new Map(),
): EmparejamientoClase[] {
  return clases.map((clase) => {
    const etiqueta = claseLabel(clase);
    const fijada = fijados.get(claveClase(clase));
    if (fijada) {
      const c = deClassroom.find((x) => x.id === fijada);
      return c
        ? { clase, etiqueta, destino: c, origen: 'manual', motivo: null, candidatas: [] }
        : { clase, etiqueta, destino: null, origen: null, motivo: 'fijada-sin-acceso', candidatas: [] };
    }
    // Se mira el nombre y la sección por separado: pegados, el «26/27» de un nombre como
    // «3°B Tutoría 26/27» dejaría el curso de la sección con un dígito delante.
    let candidatas = deClassroom.filter((c) => nombreDiceClase(c.nombre, clase) || nombreDiceClase(c.seccion, clase));
    candidatas = candidatas.filter((c) => {
      const curso = cursoEnNombre(c.nombre) ?? cursoEnNombre(c.seccion);
      return !curso || curso === academicYear;
    });
    if (candidatas.length > 1) {
      const tutorias = candidatas.filter((c) => /TUTOR/.test(compactar(`${c.nombre ?? ''} ${c.seccion ?? ''}`)));
      if (tutorias.length > 0) candidatas = tutorias;
    }
    if (candidatas.length === 0) return { clase, etiqueta, destino: null, origen: null, motivo: 'sin-clase', candidatas: [] };
    if (candidatas.length > 1) return { clase, etiqueta, destino: null, origen: null, motivo: 'ambigua', candidatas };
    return { clase, etiqueta, destino: candidatas[0], origen: 'auto', motivo: null, candidatas: [] };
  });
}

/**
 * El id de una clase de Classroom a partir de lo que se pega: el enlace de la clase
 * (`https://classroom.google.com/c/NzQxMjM0NTY3ODkw`, con o sin `/u/1/`, con `?cjc=…` detrás) o
 * el id a secas. En el enlace, el id va en base64 del número de la clase; la API usa el número.
 * `null` si no parece nada de eso.
 */
export function courseIdDeEnlace(texto: string): string | null {
  const t = texto.trim();
  if (/^\d{5,}$/.test(t)) return t;
  const m = t.match(/classroom\.google\.com\/(?:u\/\d+\/)?c\/([A-Za-z0-9_-]+)/);
  const b64 = m?.[1] ?? (/^[A-Za-z0-9_-]{8,}$/.test(t) ? t : null);
  if (!b64) return null;
  try {
    const base = b64.replace(/-/g, '+').replace(/_/g, '/');
    const dec = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='));
    return /^\d{5,}$/.test(dec) ? dec : null;
  } catch {
    return null;
  }
}

/** Sustituye `{titulo}`, `{curso}`, `{curso_escolar}` y `{enlace}`; lo desconocido se deja tal cual. */
export function rellenarTextoClassroom(
  plantilla: string,
  vars: { titulo: string; curso: string; academicYear: string; enlace: string },
): string {
  const mapa: Record<string, string> = {
    titulo: vars.titulo,
    curso: vars.curso,
    curso_escolar: vars.academicYear,
    enlace: vars.enlace,
  };
  return plantilla.replace(/\{(\w+)\}/g, (m, k: string) => mapa[k.toLowerCase()] ?? m);
}

/**
 * Fecha límite de una tarea de Classroom: la API la pide en UTC, separada en fecha y hora.
 * `null` si la fecha no es válida.
 */
export function fechaLimiteUtc(d: Date): { dueDate: { year: number; month: number; day: number }; dueTime: { hours: number; minutes: number } } | null {
  if (Number.isNaN(d.getTime())) return null;
  return {
    dueDate: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    dueTime: { hours: d.getUTCHours(), minutes: d.getUTCMinutes() },
  };
}

/**
 * El tema de Classroom donde se agrupan las tareas de evaluación en cada clase (David,
 * 4-oct-2026). Se busca por nombre y se crea si no está. Los anuncios no admiten tema.
 */
export const TEMA_CLASSROOM = 'Evaluamos 🔍 Tu opinión cuenta';

/** Formato de las publicaciones, decidido por David (4-oct-2026). El enlace va como adjunto. */
export const TEXTO_CLASSROOM_POR_DEFECTO = {
  titulo: 'Evalúa 🔎 {titulo}',
  cuerpo: 'Ayúdanos a mejorar evaluando la tutoría que hemos hecho 🤗',
} as const;

/**
 * El título del formulario sin el sector que se le añade en las evaluaciones conjuntas
 * («Tutoría Paz · Alumnado» → «Tutoría Paz»): el alumnado no tiene por qué ver «Alumnado».
 */
export function tituloSinAudiencia(titulo: string): string {
  const sector = AUDIENCIAS.map((a) => a.label).join('|');
  return titulo.replace(new RegExp(`\\s*·\\s*(?:${sector})\\s*$`, 'i'), '').trim() || titulo;
}
