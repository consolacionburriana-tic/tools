// Constantes y helpers client-safe del módulo Licencias (sin imports de DB)

// Las 8 opciones de curso del formulario (curso del año de la campaña).
// `value` = curso de catálogo (libros) · `base` = curso del alumno en BBDD (para identificar).
export const CURSOS_FORM = [
  { value: '6PRI', label: '6º EP', base: '6PRI' },
  { value: '1ESO', label: '1º ESO', base: '1ESO' },
  { value: '2ESO', label: '2º ESO', base: '2ESO' },
  { value: '3ESO', label: '3º ESO', base: '3ESO' },
  { value: '3PDC', label: '3º ESO PDC', base: '3ESO' },
  { value: '4ESO', label: '4º ESO', base: '4ESO' },
  { value: '4PDC', label: '4º ESO PDC', base: '4ESO' },
] as const;

export type CursoForm = (typeof CURSOS_FORM)[number]['value'];


export function cursoLabel(curso: string): string {
  return CURSOS_FORM.find((c) => c.value === curso)?.label ?? curso;
}

// PDC: en la BBDD el alumno PDC tiene letra = "PDC". Solo 3ESO/4ESO tienen PDC.
export function isPdcLetra(letra: string | null | undefined): boolean {
  return /pdc/i.test(letra ?? '');
}

export function toPdcCurso(curso: string): string {
  if (curso === '3ESO') return '3PDC';
  if (curso === '4ESO') return '4PDC';
  return curso;
}

// Curso "efectivo" para catálogo/pedido: si el alumno es PDC, su variante PDC
export function cursoEfectivo(baseCurso: string, letra: string | null | undefined, seleccionado?: string): string {
  if (isPdcLetra(letra)) return toPdcCurso(baseCurso);
  return seleccionado ?? baseCurso;
}

// Nombre enmascarado: "María" -> "Mar." (no revela el nombre completo)

// Apellidos enmascarados: revela solo las palabras que la familia ha tecleado,
// el resto a inicial. "Felguera Martínez" + "fel" -> "Felguera M."

// Normaliza para comparar apellidos (sin acentos, minúsculas, espacios colapsados)
export function normalize(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Colapsa pares bilingües -CAS/-VAL según la lengua base del alumno
const SUFFIX = /-(CAS|VAL)$/;
export function resolveBilingual<T extends { cod: string }>(books: T[], lengua: string | null): T[] {
  const wantVal = normalize(lengua ?? '').startsWith('valen');
  const groups = new Map<string, T[]>();
  for (const b of books) {
    const base = b.cod.replace(SUFFIX, '');
    const arr = groups.get(base) ?? [];
    arr.push(b);
    groups.set(base, arr);
  }
  const out: T[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    const cas = arr.find((b) => /-CAS$/.test(b.cod));
    const val = arr.find((b) => /-VAL$/.test(b.cod));
    if (cas && val) out.push(wantVal ? val : cas);
    else out.push(...arr);
  }
  return out;
}

// Código base sin sufijo de idioma (-CAS/-VAL), para casar packs con libros resueltos
export function baseCod(cod: string): string {
  return cod.replace(/-(CAS|VAL)$/, '');
}

export function euros(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/**
 * Total de un pedido: filtra los códigos que existen en el catálogo y suma sus
 * precios de confianza (el catálogo, no lo que mande el cliente). Compartido por
 * upsertOrder y updateOrderItemsAdmin en licencias-server.ts para que el total que
 * ve la familia y el que recalcula el panel sean siempre el mismo cálculo.
 */
export function totalPedido(
  cods: string[],
  byCod: Map<string, { precio: string | null }>,
): { valid: string[]; total: number; totalStr: string } {
  const valid = cods.filter((c) => byCod.has(c));
  const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
  return { valid, total, totalStr: total.toFixed(2) };
}

// ── Correos a familias (magic links) ──────────────────────────────────────────
// Helpers puros compartidos por la vista previa del panel y por el envío real, para que
// lo que David ve en pantalla sea EXACTAMENTE lo que recibe la familia.

/** El plazo cierra automáticamente a las 23:59:59 del día fijado en `orderDeadline`. */
export function plazoVencido(deadline: string | null | undefined, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return now > new Date(`${deadline}T23:59:59`);
}

/** Abierta de cara a la familia: el status lo permite Y el plazo (si hay fecha fijada) no ha vencido. */
export function campaignAbierta(
  campaign: { status: string; orderDeadline: string | null },
  now?: Date,
): boolean {
  return campaign.status === 'open' && !plazoVencido(campaign.orderDeadline, now);
}

/** ¿El pedido se procesa antes del inicio de curso? (7 de septiembre del año de inicio). */
export function procesadoAntesDeCurso(academicYear: string, now: Date = new Date()): boolean {
  const startYear = parseInt(academicYear, 10);
  return now < new Date(startYear, 8, 7);
}

/** Días naturales hasta las 23:59 del `deadline` (negativo si ya pasó). `null` si no hay fecha fijada. */
export function diasHastaCierre(deadline: string | null | undefined, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const fin = new Date(`${deadline}T23:59:59`);
  return Math.ceil((fin.getTime() - now.getTime()) / 86_400_000);
}

/** Resumen corto para mostrar de un vistazo sin abrir el formulario de cierre automático. */
export function cierreAutomaticoResumen(deadline: string | null | undefined, now: Date = new Date()): string {
  if (!deadline) return 'Sin fecha de cierre automático';
  const dias = diasHastaCierre(deadline, now)!;
  const fecha = new Date(deadline + 'T00:00:00').toLocaleDateString('es-ES');
  if (dias > 1) return `Cierra en ${dias} días · ${fecha}`;
  if (dias === 1) return `Cierra mañana · ${fecha}`;
  if (dias === 0) return `Cierra hoy a las 23:59`;
  return `Cerró automáticamente el ${fecha}`;
}

export function fechaLimiteLabel(deadline: string | null | undefined): string {
  if (!deadline) return 'la fecha que indique el colegio';
  // Sin la coma que mete toLocaleDateString ("sábado, 12 de septiembre"): el texto se lee
  // dentro de una frase ("el plazo termina el sábado 12 de septiembre").
  return new Date(deadline + 'T00:00:00')
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');
}

/** "Marc (3º ESO) y Laia (6º EP)" — nombre de pila + curso, en lenguaje natural. */
export function listaHijos(hijos: { nombre: string; curso: string }[]): string {
  const partes = hijos.map((h) => `${h.nombre} (${cursoLabel(h.curso)})`);
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export interface FamiliaVarsInput {
  tutorNombre: string | null;
  hijos: { nombre: string; curso: string }[];
  enlace: string;
  deadline: string | null;
  academicYear: string;
}

/** Variables disponibles en el cuerpo del correo a familias. */
export function varsDeFamilia(i: FamiliaVarsInput): Record<string, string> {
  return {
    tutor: i.tutorNombre?.trim() || 'familia',
    hijos: listaHijos(i.hijos),
    hijo: i.hijos[0]?.nombre ?? '',
    cursos: [...new Set(i.hijos.map((h) => cursoLabel(h.curso)))].join(', '),
    enlace: i.enlace,
    fecha_limite: fechaLimiteLabel(i.deadline),
    curso_escolar: i.academicYear,
  };
}

export const VARIABLES_FAMILIA = ['tutor', 'hijos', 'hijo', 'cursos', 'fecha_limite', 'curso_escolar', 'enlace'] as const;

// Tipos compartidos cliente/servidor
export interface Candidate {
  id: string;
  maskedName: string;
  apellidos: string;
  cursoLabel: string;
  conPedido: boolean;
}

export interface CatalogBook {
  cod: string;
  asignatura: string;
  nombreLibro: string;
  editorial: string;
  precio: string;
  bancoLibros: boolean;
  lengua: string | null;
}
