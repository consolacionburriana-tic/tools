// Helper puro para mostrar/ordenar profesorado de forma consistente en todo el repo.
//
// Criterio (acordado con David): por ETAPA primero (infantil → primaria → secundaria),
// dentro de cada etapa los TUTORES por orden de su clase y luego el resto de profes
// ("otros") alfabéticos por nombre. Los profes sin etapa caen en una sección "General".
import { ordenCurso, type Etapa } from '@/lib/cursos';
import { nombresDe, type NombrePersona } from '@/lib/personas';

export interface ProfeItem {
  id: string;
  nombre: string;
  etapa: string | null;
  esTutor: boolean;
  claseTutor: string | null;
}

export interface ProfeGrupo<T extends ProfeItem = ProfeItem> {
  clave: Etapa | 'General';
  label: string;
  tutores: T[];
  otros: T[];
  /** Todos (tutores primero, luego otros) para pintar como lista plana. */
  items: T[];
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
export function agruparProfes<T extends ProfeItem>(profes: T[]): ProfeGrupo<T>[] {
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

// ─── El nombre visible del profesorado ("given name") ─────────────────────────
//
// UN solo sitio decide cómo se escribe el nombre de un profe en TODAS las salidas: el
// ASM (`staff.csv`), el cuaderno de tutor, los correos y los paneles. Lo que hay en
// Educamos («JOSE MANUEL SANCHEZ GIL») no vale para eso, así que:
//
//   1. si en su ficha hay un nombre puesto a mano (`edu_teachers.nombre_mostrado`,
//      editable en /gestion/profes), ese manda;
//   2. si no, se usa la heurística de `nombreDePila()` («Carlos Andrés» → «Carlos»).
//
// Añadir un sitio nuevo donde salga un profe = llamar aquí, nunca volver a juntar
// `[nombre, apellido1]` a mano.

/** Lo mínimo que hace falta de un profe para escribir su nombre (una fila de `edu_teachers`). */
export interface ProfeNombrable {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  nombreMostrado?: string | null;
}

/** Los cuatro nombres de un profe: `completo`, `usual`, `corto`, `pila` y `apellidos`. */
export function nombresDeProfe(profe: ProfeNombrable | null | undefined): NombrePersona {
  return nombresDe(profe ?? null);
}

/** `Carlos Valero Aicart` — el nombre de un profe para cualquier sitio donde se le nombre. */
export function nombreProfe(profe: ProfeNombrable | null | undefined): string {
  return nombresDeProfe(profe).usual;
}

/** `Carlos Valero` — nombre y un apellido, para listas y desplegables. */
export function nombreProfeBreve(profe: ProfeNombrable | null | undefined): string {
  const n = nombresDeProfe(profe);
  return [n.pila, n.apellidos.split(' ')[0] ?? ''].filter(Boolean).join(' ');
}

/** `Carlos` — solo el nombre de pila: el `first_name` del ASM y el saludo de un correo. */
export function pilaProfe(profe: ProfeNombrable | null | undefined): string {
  return nombresDeProfe(profe).pila;
}
