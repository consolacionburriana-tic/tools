// Helpers puros de cursos y etapas (sin IO, testeables).
//
// Los códigos de curso de la BBDD central (edu_students.curso) tienen esta forma:
//   Infantil    : 3INF, 4INF, 5INF          → etapa EI (3-4-5 años)
//   Primaria    : 1PRI … 6PRI               → etapa EP
//   ESO         : 1ESO … 4ESO               → etapa ESO
//   PDC         : 3ºPPDC, 4ºPPDC (letra PDC) → etapa ESO (vale también 3ºPDC, 3ESOPDC, 3PDC)
//   Bachillerato: 1BACH, 2BACH              → etapa BACH
//
// **Convención de Bachillerato** (David, 30-sep-2026: aún no hay un export real con
// Bachillerato, así que esto está deducido de cómo Educamos nombra el resto): `{1|2}BACH` y,
// si hay más de una línea, la letra aparte (`1BACHA`). Se reconocen también `BAT`, `BTO`,
// `BAC` y `BACHILLERATO` (con o sin `º`), y al importar se guardan siempre como `1BACH`/`2BACH`.
// Cuando llegue un fichero real, se ajusta SOLO aquí y en `parseClase` (educamos.ts).
//
// El orden natural para mostrar clases al claustro es SIEMPRE por etapa
// (infantil → primaria → secundaria → bachillerato) y, dentro de cada etapa, por curso.
//
// **Para añadir otra etapa (FP, escuela infantil…)**: añadirla a `ETAPAS` (en su orden), a
// `ETAPA_LABEL`, y darle sitio en `etapaDeCurso`, `cursoSiguiente` y `cursoEnBanco`. El
// compilador señala el resto: todo lo que es un `Record<Etapa, …>` no compila hasta que la tenga.

/** Las etapas que la plataforma sabe trabajar, en el orden en que se enseñan. */
export const ETAPAS = ['EI', 'EP', 'ESO', 'BACH'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Cómo se llama cada etapa en pantalla. */
export const ETAPA_LABEL: Record<Etapa, string> = {
  EI: 'Infantil',
  EP: 'Primaria',
  ESO: 'Secundaria',
  BACH: 'Bachillerato',
};

export function esEtapa(valor: unknown): valor is Etapa {
  return typeof valor === 'string' && (ETAPAS as readonly string[]).includes(valor);
}

/** Etapa a la que pertenece un código de curso (o null si no se reconoce). */
export function etapaDeCurso(curso: string | null | undefined): Etapa | null {
  if (!curso) return null;
  const c = curso.toUpperCase();
  if (c.includes('INF')) return 'EI';
  if (c.includes('PRI')) return 'EP';
  if (c.includes('ESO') || c.includes('PDC')) return 'ESO';
  if (c.includes('BAC') || c.includes('BAT') || c.includes('BTO')) return 'BACH';
  return null;
}

/**
 * Bachillerato en todas sus grafías → `{ curso: '1BACH'|'2BACH', letra }`, o `null` si no lo es.
 * Recibe el código ya en MAYÚSCULAS y sin espacios ni acentos. La letra (o modalidad) puede ser
 * de 0 a 3 caracteres: `1BACH` (una línea), `1BACHA`, `2BACHCT`. Es EL sitio donde se decide
 * cómo se lee Bachillerato: Educamos, Horarios y las tutorías pasan por aquí.
 */
export function parseBachillerato(codigo: string): { curso: string; letra: string | null } | null {
  const m = codigo.match(/^(\d)[º°]?(?:BACHILLERATO|BACH|BATX|BAT|BTO|BAC)([A-Z]{0,3})$/);
  return m ? { curso: `${m[1]}BACH`, letra: m[2] || null } : null;
}

/**
 * ¿Es un curso o clase de PDC? Educamos lo llama `3ºPPDC` (por su programa), pero otro colegio
 * puede tenerlo como `3ºPDC`, `3ESOPDC` o `3PDC`, o solo con la letra `PDC`. Todas valen.
 */
export function esPdc(curso: string | null | undefined, letra?: string | null): boolean {
  return /PDC/i.test(curso ?? '') || (letra ?? '').toUpperCase() === 'PDC';
}

/**
 * Curso "de verdad" de un alumno de PDC: `'3ºPPDC'` → `'3ESO'`, `'4ºPPDC'` → `'4ESO'`.
 * El resto se devuelve tal cual.
 *
 * Educamos llama al PDC por su programa (`3ºPPDC`), pero para todo lo demás un alumno de
 * 3º PDC **es de 3º de ESO** con letra `PDC` (así lo tiene Licencias, ver `CURSOS_FORM`).
 * Sin esta traducción los PDC se caen de cualquier filtro por curso de ESO — que es
 * justo lo que hacía que el sync de alumnado de Licencias los diera de baja en bloque.
 */
export function cursoBaseEso(curso: string | null | undefined): string | null {
  if (!curso) return curso ?? null;
  const m = curso.toUpperCase().match(/^(\d+)[^\d]*PDC$/);
  return m ? `${m[1]}ESO` : curso;
}

/** Nivel numérico dentro de la etapa: '3INF' → 3, '4ºPPDC' → 4, '1ESO' → 1. */
export function nivelDeCurso(curso: string | null | undefined): number {
  if (!curso) return 99;
  const m = curso.match(/\d+/);
  return m ? Number(m[0]) : 99;
}

const ETAPA_ORDEN: Record<Etapa, number> = { EI: 0, EP: 1, ESO: 2, BACH: 3 };

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
 * - **Bachillerato** sube `1→2` y **2º egresa**. (Regla por defecto, sin decidir con David:
 *   es la de cualquier Bachillerato de dos cursos.)
 * El código de curso se reconstruye cambiando solo el número inicial, así que respeta
 * los formatos raros (`3ºPPDC`) tal cual vienen de Educamos.
 */
export function cursoSiguiente(curso: string | null | undefined): string | null {
  const etapa = etapaDeCurso(curso);
  // El destino se construye cambiando el número inicial: sin número delante (`BACH1`) no hay a dónde ir.
  if (!curso || !etapa || !/^\d/.test(curso)) return null;
  const nivel = nivelDeCurso(curso);
  let destino: number | null;
  if (etapa === 'EI') {
    if (nivel < 3 || nivel > 5) return null;
    destino = nivel === 5 ? 3 : nivel + 1;
  } else if (etapa === 'EP') {
    if (nivel < 1 || nivel > 6) return null;
    destino = nivel % 2 === 1 ? nivel + 1 : nivel - 1;
  } else if (etapa === 'ESO') {
    if (nivel < 1 || nivel > 4) return null;
    destino = nivel === 4 ? null : nivel + 1;
  } else {
    // Bachillerato: dos cursos, sube 1º → 2º y 2º egresa.
    if (nivel < 1 || nivel > 2) return null;
    destino = nivel === 2 ? null : nivel + 1;
  }
  return destino === null ? null : curso.replace(/^\d+/, String(destino));
}

export function cursoEnBanco(curso: string | null | undefined): boolean {
  const etapa = etapaDeCurso(curso);
  if (etapa === 'EI') return false;
  if (etapa === 'EP') return nivelDeCurso(curso) >= 3;
  if (etapa === 'ESO') return true;
  return false; // Bachillerato no entra en el banco (la Xarxa de Llibres llega hasta 4º ESO)
}

/**
 * Qué hacer con `edu_students.banco_libros` cuando el sync de Educamos da de alta a un alumno
 * (`antes` = null) o le cambia el curso. Devuelve el valor a escribir, o `null` = no tocar.
 *
 * - **Alta**: en el banco si su curso lo tiene. Sin esto, la columna nacía a `true` por su
 *   DEFAULT y en septiembre de 2026 había 85 alumnos de Infantil y 1º-2º EP «en el banco»,
 *   que no existe en esos cursos (limpiados el 28-sep-2026, ver `docs/24-numeros.md`).
 * - **Entra en un curso con banco** desde uno sin (2º → 3º EP): `true`, el mismo punto de
 *   partida que un alta; los que no participan se desmarcan en el panel del banco.
 * - **Sale a un curso sin banco**: `false`.
 * - Entre dos cursos con banco (o dos sin): `null`, se respeta lo que haya marcado.
 */
export function bancoTrasCambioDeCurso(
  antes: string | null | undefined,
  despues: string | null | undefined,
): boolean | null {
  const ahora = cursoEnBanco(despues);
  if (antes == null) return ahora;
  return cursoEnBanco(antes) === ahora ? null : ahora;
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
