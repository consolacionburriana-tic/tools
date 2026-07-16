// Helpers puros de cursos y etapas (sin IO, testeables).
//
// Los códigos de curso de la BBDD central (edu_students.curso) tienen esta forma:
//   Infantil : 3INF, 4INF, 5INF          → etapa EI (3-4-5 años)
//   Primaria : 1PRI … 6PRI               → etapa EP
//   ESO      : 1ESO … 4ESO               → etapa ESO
//   PDC      : 3ºPPDC, 4ºPPDC (letra PDC) → etapa ESO
//
// El orden natural para mostrar clases al claustro es SIEMPRE por etapa
// (infantil → primaria → secundaria) y, dentro de cada etapa, por curso.

export type Etapa = 'EI' | 'EP' | 'ESO';

/** Etapa a la que pertenece un código de curso (o null si no se reconoce). */
export function etapaDeCurso(curso: string | null | undefined): Etapa | null {
  if (!curso) return null;
  const c = curso.toUpperCase();
  if (c.includes('INF')) return 'EI';
  if (c.includes('PRI')) return 'EP';
  if (c.includes('ESO') || c.includes('PDC')) return 'ESO';
  return null;
}

/** Nivel numérico dentro de la etapa: '3INF' → 3, '4ºPPDC' → 4, '1ESO' → 1. */
export function nivelDeCurso(curso: string | null | undefined): number {
  if (!curso) return 99;
  const m = curso.match(/\d+/);
  return m ? Number(m[0]) : 99;
}

const ETAPA_ORDEN: Record<Etapa, number> = { EI: 0, EP: 1, ESO: 2 };

/**
 * Clave de orden global de un curso: etapa (infantil→primaria→secundaria) y
 * dentro de la etapa, nivel. Devuelve un número comparable directamente.
 */
export function ordenCurso(curso: string | null | undefined): number {
  const etapa = etapaDeCurso(curso);
  const base = etapa ? ETAPA_ORDEN[etapa] * 100 : 900;
  return base + nivelDeCurso(curso);
}

/** Comparador de clases (curso + letra) por etapa, curso y letra. */
export function compararClases(
  a: { curso: string | null; letra: string | null },
  b: { curso: string | null; letra: string | null },
): number {
  const d = ordenCurso(a.curso) - ordenCurso(b.curso);
  if (d !== 0) return d;
  return (a.letra ?? '').localeCompare(b.letra ?? '', 'es');
}

/**
 * ¿Este curso entra en el banco de libros? El banco arranca en 3º de primaria;
 * infantil, 1º y 2º de primaria quedan fuera. Secundaria y PDC entran siempre.
 */
export function cursoEnBanco(curso: string | null | undefined): boolean {
  const etapa = etapaDeCurso(curso);
  if (etapa === 'EI') return false;
  if (etapa === 'EP') return nivelDeCurso(curso) >= 3;
  if (etapa === 'ESO') return true;
  return false;
}
