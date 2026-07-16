// Helper puro para mostrar/ordenar profesorado de forma consistente en todo el repo.
//
// Criterio (acordado con David): por ETAPA primero (infantil → primaria → secundaria),
// dentro de cada etapa los TUTORES por orden de su clase y luego el resto de profes
// ("otros") alfabéticos por nombre. Los profes sin etapa caen en una sección "General".
import { ordenCurso, type Etapa } from '@/lib/cursos';

export interface ProfeItem {
  id: string;
  nombre: string;
  etapa: string | null;
  esTutor: boolean;
  claseTutor: string | null;
}

export interface ProfeGrupo {
  clave: Etapa | 'General';
  label: string;
  tutores: ProfeItem[];
  otros: ProfeItem[];
  /** Todos (tutores primero, luego otros) para pintar como lista plana. */
  items: ProfeItem[];
}

const GRUPOS: { clave: Etapa | 'General'; label: string }[] = [
  { clave: 'EI', label: 'Infantil' },
  { clave: 'EP', label: 'Primaria' },
  { clave: 'ESO', label: 'Secundaria' },
  { clave: 'General', label: 'General' },
];

/** Letra de la clase del tutor: '3INFA' → 'A', '3º PPDC' → ''. */
function letraDeClase(claseTutor: string | null): string {
  if (!claseTutor) return '';
  const m = claseTutor.trim().match(/([A-Z])\s*$/i);
  return m ? m[1].toUpperCase() : '';
}

function ordenTutor(p: ProfeItem): number {
  return ordenCurso(p.claseTutor) * 10 + (letraDeClase(p.claseTutor).charCodeAt(0) || 0) / 100;
}

/** Normaliza una clase ('3INFA', '3º PPDC') a una clave curso|letra comparable. */
export function claseTutorAKey(claseTutor: string | null): string | null {
  if (!claseTutor) return null;
  const limpio = claseTutor.toUpperCase().replace(/[º°.\s]/g, '');
  const m = limpio.match(/^(\d+)(INF|PRI|ESO|PPDC|PDC)([A-Z]?)$/);
  if (!m) return null;
  const [, nivel, tramo, letra] = m;
  if (tramo === 'PPDC' || tramo === 'PDC') return `${nivel}ºPPDC|PDC`;
  return `${nivel}${tramo}|${letra}`;
}

/** Agrupa el profesorado por etapa siguiendo el criterio del repo. */
export function agruparProfes(profes: ProfeItem[]): ProfeGrupo[] {
  return GRUPOS.map(({ clave, label }) => {
    const delGrupo = profes.filter((p) => (p.etapa ?? 'General') === clave);
    const tutores = delGrupo
      .filter((p) => p.esTutor)
      .sort((a, b) => ordenTutor(a) - ordenTutor(b));
    const otros = delGrupo
      .filter((p) => !p.esTutor)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { clave, label, tutores, otros, items: [...tutores, ...otros] };
  }).filter((g) => g.items.length > 0);
}
