// Helpers puros de Salidas (sin IO): nada de aquí toca la BBDD, así que también lo
// puede importar un componente cliente (el listado agrupa y filtra en el navegador).
import { academicYearActual } from '@/lib/constants';
import { compararClases, ordenCurso } from '@/lib/cursos';
// `claseLarga` («1ESO» → «1º ESO», y el PPDC de Educamos → «PDC») es puro, así que también
// lo puede importar este fichero, que se usa desde un componente cliente.
import { claseLarga } from '@/lib/alumnado';

export interface Clase {
  curso: string;
  letra: string | null;
}

export function claseLabel(c: Clase): string {
  return c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso;
}

/** Días de margen tras la fecha de la salida antes de darla por pasada (da tiempo a
 *  que las familias rezagadas suban el justificante). */
export const DIAS_GRACIA_ARCHIVO = 3;

/** Una salida se archiva sola: sin fecha nunca se archiva (no hay forma de saber si ya
 *  pasó), con fecha se archiva a partir del día siguiente al margen de gracia. */
export function tripArchivada(fecha: string | null, ahora: Date = new Date()): boolean {
  if (!fecha) return false;
  const limite = new Date(fecha + 'T00:00:00');
  limite.setDate(limite.getDate() + DIAS_GRACIA_ARCHIVO + 1);
  return ahora >= limite;
}

/** Curso escolar al que pertenece una salida: el de su fecha si la tiene, si no el de
 *  cuándo se creó (para las que se dejaron sin fecha). */
export function cursoDeSalida(fecha: string | null, createdAt: Date): string {
  return academicYearActual(fecha ? new Date(fecha + 'T00:00:00') : createdAt);
}

// ─── Agrupar por nivel dentro de un curso escolar ─────────────────────────────
//
// Ojo con la palabra «curso», que aquí significa dos cosas distintas:
//   · `cursoDeSalida()` (arriba) da el CURSO ESCOLAR: '2026-27'.
//   · lo de aquí abajo da el NIVEL: '1ESO', '4ESO'.
// El listado agrupa primero por curso escolar y, dentro, por nivel.

/**
 * El nivel por el que se ordena una salida: **el más bajo** de los que la hacen.
 *
 * Una salida puede abarcar varias clases (1º ESO A + 1º ESO B) e incluso varios niveles (una
 * convivencia de toda la ESO). Se agrupa por el más bajo porque es donde la busca quien la
 * busca: «la del Termet, la de primero».
 */
export function nivelDeSalida(clases: readonly Clase[] | null | undefined): string | null {
  if (!clases || clases.length === 0) return null;
  return [...clases].sort(compararClases)[0]?.curso ?? null;
}

export interface GrupoNivel<T> {
  /** Clave estable: el código del nivel, o `''` para las que no tienen clase. */
  nivel: string;
  /** Lo que se pinta en el separador: «1º ESO», o «Sin clase asignada». */
  etiqueta: string;
  salidas: T[];
}

/**
 * Agrupa por nivel, **de menos a más**, para poder pintar un separador por nivel. Dentro de
 * cada grupo van por fecha (la más próxima primero) y, a igualdad, por nombre: entre
 * «… — 1ESO A» y «… — 1ESO B» sale antes la A.
 *
 * Las salidas sin clase asignada no se pierden: caen en un grupo propio al final.
 */
export function agruparPorNivel<T extends { nombre: string; fecha: string | null; clases: Clase[] | null }>(
  salidas: readonly T[],
): GrupoNivel<T>[] {
  const grupos = new Map<string, GrupoNivel<T>>();

  for (const salida of salidas) {
    const nivel = nivelDeSalida(salida.clases) ?? '';
    let grupo = grupos.get(nivel);
    if (!grupo) {
      grupo = { nivel, etiqueta: nivel ? claseLarga(nivel, null) : 'Sin clase asignada', salidas: [] };
      grupos.set(nivel, grupo);
    }
    grupo.salidas.push(salida);
  }

  for (const grupo of grupos.values()) {
    grupo.salidas.sort(
      (a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.nombre.localeCompare(b.nombre, 'es'),
    );
  }

  // `ordenCurso` ordena por etapa y luego por nivel, así que Infantil va antes que Primaria y
  // 1º antes que 4º. El grupo sin clase se manda al final con un orden altísimo.
  //
  // El desempate por código importa: `3ESO` y `3ºPPDC` (el PDC) tienen el MISMO orden —misma
  // etapa y mismo nivel—, y sin él quedaban en el orden en que llegaran de la BBDD, que es
  // decir al azar. Alfabéticamente `3ESO` va antes que `3ºPPDC`, que es lo que se espera.
  return [...grupos.values()].sort(
    (a, b) =>
      (a.nivel ? ordenCurso(a.nivel) : 9999) - (b.nivel ? ordenCurso(b.nivel) : 9999) ||
      a.nivel.localeCompare(b.nivel, 'es'),
  );
}
