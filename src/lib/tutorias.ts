// Helpers puros de Tutorías (sin IO): el plan de "promocionar +1 curso" se calcula aquí
// para poder enseñarlo antes de aplicarlo y para poder testearlo.
import { cursoSiguiente } from '@/lib/cursos';

export interface ClaseTutores {
  curso: string;
  letra: string | null;
  tutores: { id: string; teacherId: string; nombre: string }[];
}

/**
 * Lo que la pantalla de tutorías necesita saber de cada clase. Lo devuelven tanto el
 * server component como los endpoints de gestión, de ahí que `repartoConfirmadoAt` pueda
 * llegar como `Date` (props de servidor) o como `string` (JSON de la API).
 */
export interface ClaseConTutoresUI extends ClaseTutores {
  numAlumnos: number;
  conTutorPersonal: number;
  repartoConfirmadoAt: Date | string | null;
}

/** Por qué una tutoría se queda sin destino al promocionar. */
export type MotivoSinDestino = 'egresa' | 'sin-clase';

export interface CambioPromocion {
  tutoriaId: string;
  teacherId: string;
  nombre: string;
  desde: { curso: string; letra: string | null };
  /** null = la tutoría se libera; el motivo dice por qué. */
  hasta: { curso: string; letra: string | null } | null;
  motivo: MotivoSinDestino | null;
}

export function claseLabel(curso: string, letra: string | null): string {
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}

const clave = (curso: string, letra: string | null) => `${curso}|${letra ?? ''}`;

/**
 * Plan de promoción: una entrada por tutoría existente, con su destino o el motivo por el
 * que se queda sin él. Solo se propone mover a clases que EXISTEN de verdad (con alumnado):
 * si `6PRI C` promociona a `5PRI C` pero ese grupo no existe, la tutoría se libera en vez
 * de inventarse una clase.
 */
export function planPromocion(clases: ClaseTutores[]): CambioPromocion[] {
  const existen = new Set(clases.map((c) => clave(c.curso, c.letra)));
  const cambios: CambioPromocion[] = [];

  for (const c of clases) {
    const cursoDestino = cursoSiguiente(c.curso);
    for (const t of c.tutores) {
      const base = {
        tutoriaId: t.id,
        teacherId: t.teacherId,
        nombre: t.nombre,
        desde: { curso: c.curso, letra: c.letra },
      };
      if (!cursoDestino) {
        cambios.push({ ...base, hasta: null, motivo: 'egresa' });
      } else if (!existen.has(clave(cursoDestino, c.letra))) {
        cambios.push({ ...base, hasta: null, motivo: 'sin-clase' });
      } else {
        cambios.push({ ...base, hasta: { curso: cursoDestino, letra: c.letra }, motivo: null });
      }
    }
  }
  return cambios;
}

export const resumenPlan = (cambios: CambioPromocion[]) => ({
  movidas: cambios.filter((c) => c.hasta).length,
  liberadas: cambios.filter((c) => !c.hasta).length,
});

// ─── Reparto de alumnos entre los tutores de una clase ────────────────────────
//
// Cuando una clase tiene dos (o tres) tutores, cada alumno tiene un **tutor personal**:
// uno solo de ellos. El reparto habitual es por orden alfabético y por mitades (los 15
// primeros de 30 para uno, los 15 siguientes para el otro), así que todo lo de aquí
// trabaja sobre `alumnos` = ids YA ORDENADOS como se ven en pantalla.
//
// `Reparto` es el mapa alumno → tutor; un alumno sin entrada (o con `null`) es un alumno
// **sin tutor personal**, que es lo que pasa con el alumnado que llega a mitad de curso:
// nunca se autoasigna, se queda pendiente y la pantalla avisa.

/** alumnoId → teacherId del tutor personal (o `null`/ausente si no tiene). */
export type Reparto = Record<string, string | null>;

/** Cuántos alumnos se quedan sin tutor personal. */
export const sinTutorPersonal = (alumnos: string[], reparto: Reparto): number =>
  alumnos.filter((a) => !reparto[a]).length;

/** Cuántos alumnos lleva cada tutor (incluye a los tutores con 0). */
export function repartoPorTutor(alumnos: string[], reparto: Reparto, tutores: string[]): Record<string, number> {
  const cuenta: Record<string, number> = Object.fromEntries(tutores.map((t) => [t, 0]));
  for (const a of alumnos) {
    const t = reparto[a];
    if (t && t in cuenta) cuenta[t]++;
  }
  return cuenta;
}

/**
 * Tutores en el orden en el que aparecen a lo largo de la lista (los que no aparecen van
 * al final, en el orden de la clase). Es lo que permite que un corte nuevo respete una
 * inversión previa: si la lista va "Luis y luego Ana", el corte sigue dejando a Luis arriba.
 */
export function ordenDeBloques(alumnos: string[], reparto: Reparto, tutores: string[]): string[] {
  const orden: string[] = [];
  for (const a of alumnos) {
    const t = reparto[a];
    if (t && tutores.includes(t) && !orden.includes(t)) orden.push(t);
  }
  return [...orden, ...tutores.filter((t) => !orden.includes(t))];
}

/**
 * Posiciones de corte del reparto actual: índices `i` tales que el alumno `i` empieza un
 * bloque nuevo respecto al anterior **que tenga tutor** (los huecos no cortan nada).
 */
export function cortesDeReparto(alumnos: string[], reparto: Reparto): number[] {
  const cortes: number[] = [];
  let ultimo: string | null = null;
  alumnos.forEach((a, i) => {
    const t = reparto[a] ?? null;
    if (!t) return;
    if (ultimo && t !== ultimo) cortes.push(i);
    ultimo = t;
  });
  return cortes;
}

/** Reparte por bloques contiguos según los cortes dados (el bloque `j` va al tutor `j`). */
function repartirPorCortes(alumnos: string[], tutores: string[], cortes: number[]): Reparto {
  const reparto: Reparto = {};
  let bloque = 0;
  alumnos.forEach((a, i) => {
    if (cortes.includes(i)) bloque++;
    reparto[a] = tutores[Math.min(bloque, tutores.length - 1)] ?? null;
  });
  return reparto;
}

/**
 * Reparto por mitades (o tercios) en el orden de la lista: con 31 alumnos y 2 tutores,
 * 16 para el primero y 15 para el segundo. Es el punto de partida por defecto.
 */
export function repartoPorMitades(alumnos: string[], tutores: string[]): Reparto {
  if (tutores.length === 0) return {};
  const base = Math.floor(alumnos.length / tutores.length);
  const sobran = alumnos.length % tutores.length;
  const cortes: number[] = [];
  let pos = 0;
  for (let j = 0; j < tutores.length - 1; j++) {
    pos += base + (j < sobran ? 1 : 0);
    cortes.push(pos);
  }
  return repartirPorCortes(alumnos, tutores, cortes);
}

/**
 * Cortar por un punto concreto de la lista: "de aquí hacia arriba, uno; de aquí hacia
 * abajo, el otro". `gap` es el índice del alumno que abre el bloque de abajo (1..n-1).
 *
 * Con tres tutores hay dos cortes: si todavía falta alguno se añade el nuevo, y si ya
 * están los dos se **mueve el más cercano** al punto tocado (que es lo que uno espera al
 * tocar cerca de una línea de corte ya dibujada).
 */
export function aplicarCorte(alumnos: string[], tutores: string[], reparto: Reparto, gap: number): Reparto {
  if (tutores.length < 2 || gap <= 0 || gap >= alumnos.length) return reparto;
  const maxCortes = tutores.length - 1;
  const orden = ordenDeBloques(alumnos, reparto, tutores);
  const actuales = cortesDeReparto(alumnos, reparto).filter((c) => c !== gap);

  let cortes: number[];
  if (actuales.length > maxCortes) {
    // Reparto manual "a trozos": no hay cortes que respetar, se empieza de cero.
    cortes = [gap];
  } else if (actuales.length < maxCortes) {
    cortes = [...actuales, gap];
  } else {
    const cerca = actuales.reduce((a, b) => (Math.abs(b - gap) < Math.abs(a - gap) ? b : a));
    cortes = [...actuales.filter((c) => c !== cerca), gap];
  }
  return repartirPorCortes(alumnos, orden, [...new Set(cortes)].sort((a, b) => a - b));
}

/** Invierte el orden de los tutores: el primero pasa a llevar el bloque del último. */
export function invertirReparto(reparto: Reparto, tutores: string[]): Reparto {
  const espejo = new Map(tutores.map((t, i) => [t, tutores[tutores.length - 1 - i]]));
  const salida: Reparto = {};
  for (const [alumno, tutor] of Object.entries(reparto)) {
    salida[alumno] = tutor ? espejo.get(tutor) ?? tutor : null;
  }
  return salida;
}

/**
 * Completa solo los huecos, colocando a cada alumno donde le toca **por orden de lista**:
 * hereda el tutor del alumno asignado anterior y, si no hay (está al principio de la
 * lista), el del siguiente. Es lo que se usa cuando llegan alumnos nuevos a mitad de
 * curso y hay que meterlos en el reparto que ya estaba hecho, sin rehacerlo entero.
 */
export function completarHuecos(alumnos: string[], reparto: Reparto): Reparto {
  const salida: Reparto = { ...reparto };
  const asignado = (i: number) => salida[alumnos[i]] ?? null;
  alumnos.forEach((a, i) => {
    if (salida[a]) return;
    let previo: string | null = null;
    for (let j = i - 1; j >= 0 && !previo; j--) previo = asignado(j);
    let siguiente: string | null = null;
    for (let j = i + 1; j < alumnos.length && !siguiente; j++) siguiente = reparto[alumnos[j]] ?? null;
    salida[a] = previo ?? siguiente ?? null;
  });
  return salida;
}
