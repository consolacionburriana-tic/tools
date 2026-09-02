// Helpers puros de Tutorías (sin IO): el plan de "promocionar +1 curso" se calcula aquí
// para poder enseñarlo antes de aplicarlo y para poder testearlo.
import { cursoSiguiente } from '@/lib/cursos';

export interface ClaseTutores {
  curso: string;
  letra: string | null;
  tutores: { id: string; teacherId: string; nombre: string }[];
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
