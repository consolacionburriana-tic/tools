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
  /** La clase de Classroom elegida, si hay una sola candidata clara. */
  destino: ClaseClassroomMin | null;
  /** Por qué no hay destino: ninguna candidata o varias sin desempate. */
  motivo: 'sin-clase' | 'ambigua' | null;
  /** Las candidatas cuando es ambigua, para enseñarlas. */
  candidatas: ClaseClassroomMin[];
}

/**
 * Casa cada clase del formulario con su tutoría entre las clases de Classroom de la cuenta
 * publicadora. Reglas, en este orden:
 *  1. Si el nombre dice un curso escolar, tiene que ser el de la evaluación (las de años
 *     pasados que sigan activas no cuentan).
 *  2. Si queda más de una, gana la que dice «tutoría» en el nombre.
 *  3. Si aun así hay varias, es ambigua: no se publica en ninguna y se enseña el motivo.
 */
export function emparejarClases(
  clases: readonly ClaseDeForm[],
  deClassroom: readonly ClaseClassroomMin[],
  academicYear: string,
): EmparejamientoClase[] {
  return clases.map((clase) => {
    const etiqueta = claseLabel(clase);
    let candidatas = deClassroom.filter((c) => nombreDiceClase(c.nombre, clase));
    candidatas = candidatas.filter((c) => {
      const curso = cursoEnNombre(c.nombre);
      return !curso || curso === academicYear;
    });
    if (candidatas.length > 1) {
      const tutorias = candidatas.filter((c) => /TUTOR/.test(compactar(c.nombre)));
      if (tutorias.length > 0) candidatas = tutorias;
    }
    if (candidatas.length === 0) return { clase, etiqueta, destino: null, motivo: 'sin-clase', candidatas: [] };
    if (candidatas.length > 1) return { clase, etiqueta, destino: null, motivo: 'ambigua', candidatas };
    return { clase, etiqueta, destino: candidatas[0], motivo: null, candidatas: [] };
  });
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
