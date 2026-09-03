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
 * Comparador inverso: secundaria primero, infantil al final. Lo usa Evaluaciones
 * porque quien responde de verdad son los mayores (en infantil casi no aplica), y
 * lo que se toca a diario tiene que salir arriba sin hacer scroll.
 */
export function compararClasesMayoresPrimero(
  a: { curso: string | null; letra: string | null },
  b: { curso: string | null; letra: string | null },
): number {
  const d = ordenCurso(b.curso) - ordenCurso(a.curso);
  if (d !== 0) return d;
  return (a.letra ?? '').localeCompare(b.letra ?? '', 'es');
}

/**
 * ¿Este curso entra en el banco de libros? El banco arranca en 3º de primaria;
 * infantil, 1º y 2º de primaria quedan fuera. Secundaria y PDC entran siempre.
 */
/**
 * Curso al que se pasa al promocionar de año, o `null` si no hay destino (egresa).
 * Reglas fijadas por David (2026-09-01):
 * - **Infantil** rota el ciclo 3-4-5: `3INF→4INF→5INF→3INF`.
 * - **Primaria** rota dentro del ciclo de dos años: `1↔2`, `3↔4`, `5↔6` (misma letra).
 * - **ESO** sube de verdad (`1→2→3→4`) y **4º egresa**. Los PDC siguen la misma regla
 *   por su nivel (`3ºPPDC→4ºPPDC`, `4ºPPDC` egresa).
 * El código de curso se reconstruye cambiando solo el número inicial, así que respeta
 * los formatos raros (`3ºPPDC`) tal cual vienen de Educamos.
 */
export function cursoSiguiente(curso: string | null | undefined): string | null {
  const etapa = etapaDeCurso(curso);
  if (!curso || !etapa) return null;
  const nivel = nivelDeCurso(curso);
  let destino: number | null;
  if (etapa === 'EI') {
    if (nivel < 3 || nivel > 5) return null;
    destino = nivel === 5 ? 3 : nivel + 1;
  } else if (etapa === 'EP') {
    if (nivel < 1 || nivel > 6) return null;
    destino = nivel % 2 === 1 ? nivel + 1 : nivel - 1;
  } else {
    if (nivel < 1 || nivel > 4) return null;
    destino = nivel === 4 ? null : nivel + 1;
  }
  return destino === null ? null : curso.replace(/^\d+/, String(destino));
}

export function cursoEnBanco(curso: string | null | undefined): boolean {
  const etapa = etapaDeCurso(curso);
  if (etapa === 'EI') return false;
  if (etapa === 'EP') return nivelDeCurso(curso) >= 3;
  if (etapa === 'ESO') return true;
  return false;
}

/**
 * Etiqueta de clase para pantalla: `'2ESO' + 'B'` → `'2ESO B'`, y `'3ºPPDC' + 'PDC'` →
 * `'3ºPPDC'` (en PDC la letra ES el curso, repetirla sobra). Igual que la de Registro ABC,
 * pero aquí porque no es de ningún módulo: la usa todo el que pinte una clase.
 */
export function nombreClase(curso: string | null | undefined, letra: string | null | undefined): string {
  if (!curso) return '';
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}
