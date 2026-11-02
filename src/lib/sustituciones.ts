// Sustituciones del profesorado — lógica PURA (sin IO), con tests en
// `__tests__/sustituciones.test.ts`. Las consultas viven en `sustituciones-server.ts`.
//
// «Ángela Guillamón sustituye a Alejandro Sánchez»: mientras la sustitución esté vigente,
// el sistema asume que lo de Alejandro (sus tutorías, sus avisos) es de Ángela. Vigente =
// activa (el interruptor a mano) y hoy dentro de [desde, hasta] (los dos opcionales, los dos
// inclusive). Las fechas son `yyyy-MM-dd`, así que se comparan como texto.

// Sin imports de `educamos.ts` a propósito: arrastra SheetJS y esto lo importa también el panel (cliente).
const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export type OrigenSustitucion = 'educamos' | 'manual';

export interface SustitucionBase {
  sustitutoId: string;
  titularId: string;
  desde: string | null;
  hasta: string | null;
  activa: boolean;
}

export type EstadoSustitucion = 'vigente' | 'programada' | 'caducada' | 'desactivada';

/** En qué punto está una sustitución un día dado (`hoy` = `yyyy-MM-dd`). */
export function estadoSustitucion(s: Pick<SustitucionBase, 'desde' | 'hasta' | 'activa'>, hoy: string): EstadoSustitucion {
  if (!s.activa) return 'desactivada';
  if (s.hasta && s.hasta < hoy) return 'caducada';
  if (s.desde && s.desde > hoy) return 'programada';
  return 'vigente';
}

export const esVigente = (s: Pick<SustitucionBase, 'desde' | 'hasta' | 'activa'>, hoy: string): boolean =>
  estadoSustitucion(s, hoy) === 'vigente';

/** Los titulares a los que cubre este profe ahora mismo. */
export function titularesQueCubre(sustitutoId: string, sustituciones: readonly SustitucionBase[], hoy: string): string[] {
  return [...new Set(sustituciones.filter((s) => s.sustitutoId === sustitutoId && esVigente(s, hoy)).map((s) => s.titularId))];
}

/**
 * Cambia cada titular de la lista por quien lo sustituye ahora. Quien no está sustituido se
 * queda; quien tiene varios sustitutos vigentes los deja a todos. Sin repetidos y en orden.
 * Es lo que se aplica a «los tutores de una clase» para saber a quién se avisa.
 */
export function aplicarSustituciones(
  ids: readonly string[],
  sustituciones: readonly SustitucionBase[],
  hoy: string,
): string[] {
  const vigentes = sustituciones.filter((s) => esVigente(s, hoy));
  const salida: string[] = [];
  for (const id of ids) {
    const suyos = vigentes.filter((s) => s.titularId === id).map((s) => s.sustitutoId);
    for (const x of suyos.length > 0 ? suyos : [id]) if (!salida.includes(x)) salida.push(x);
  }
  return salida;
}

/** Un tutor que está ahí porque cubre a otro: guarda a quién, para poder seguir el rastro. */
export type ConSustitucion<T> = T & { sustituyeA?: string[] };

/**
 * La lista de tutores de una clase con los titulares ausentes cambiados por quien los cubre.
 * `sustitutos` trae, ya con sus datos, a quien cubre a cada titular de la lista. El sustituto
 * ocupa el sitio del titular (se avisa a quien está, no a quien no); si ya era tutor de la
 * clase no se repite y solo se le anota a quién más cubre.
 */
export function sustituirTutores<T extends { eduTeacherId: string }>(
  tutores: readonly T[],
  sustitutos: readonly { titularId: string; sustituto: T }[],
): ConSustitucion<T>[] {
  const salida: ConSustitucion<T>[] = [];
  const poner = (t: T, cubre: string | null) => {
    const ya = salida.find((x) => x.eduTeacherId === t.eduTeacherId);
    if (ya) {
      if (cubre && !ya.sustituyeA?.includes(cubre)) ya.sustituyeA = [...(ya.sustituyeA ?? []), cubre];
      return;
    }
    salida.push(cubre ? { ...t, sustituyeA: [cubre] } : { ...t });
  };
  for (const t of tutores) {
    const suyos = sustitutos.filter((s) => s.titularId === t.eduTeacherId);
    if (suyos.length === 0) poner(t, null);
    else for (const s of suyos) poner(s.sustituto, t.eduTeacherId);
  }
  return salida;
}

// ─── Lo que dice Educamos ─────────────────────────────────────────────────────

/** Columnas del export de profes que lo cuentan (se guardan tal cual en `edu_teachers.extra`). */
export const COLUMNA_SUSTITUTO = 'PROF. SUSTITUTO';
export const COLUMNA_TITULAR = 'PROF. TITULAR';

const VERDADERO = new Set(['TRUE', 'VERDADERO', 'SI', 'S', '1', 'X']);
const esVerdadero = (v: string | null | undefined): boolean => VERDADERO.has(normalizar(v ?? ''));

/** Un profe tal como lo ve el sync: qué dice Educamos de si sustituye a alguien. */
export interface CandidatoSustituto {
  sustitutoId: string;
  /** `PROF. SUSTITUTO` = TRUE. */
  esSustituto: boolean;
  /** `PROF. TITULAR`: el nombre completo de a quién sustituye, tal cual lo escribe Educamos. */
  titularTexto: string | null;
  /** `FECHA ALTA` → desde. */
  desde: string | null;
  /** `FECHA BAJA` → hasta. */
  hasta: string | null;
}

/** Lo que dice el `extra` de un profe (jsonb del export) sobre si sustituye a alguien. */
export function candidatoDeExtra(
  sustitutoId: string,
  extra: Record<string, string> | null | undefined,
  fechas: { fechaAlta: string | null; fechaBaja: string | null },
): CandidatoSustituto {
  const titular = (extra?.[COLUMNA_TITULAR] ?? '').replace(/\s+/g, ' ').trim();
  return {
    sustitutoId,
    esSustituto: esVerdadero(extra?.[COLUMNA_SUSTITUTO]),
    titularTexto: titular || null,
    desde: fechas.fechaAlta,
    hasta: fechas.fechaBaja,
  };
}

export interface ProfeParaTitular {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  active: boolean;
}

const nombreCompletoNorm = (p: Pick<ProfeParaTitular, 'nombre' | 'apellido1' | 'apellido2'>): string =>
  normalizar([p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' '));

export type ResultadoTitular =
  | { tipo: 'ok'; id: string }
  | { tipo: 'ninguno' }
  | { tipo: 'ambiguo'; ids: string[] };

/**
 * A quién se refiere «ALEJANDRO SÁNCHEZ GIL». Se compara nombre + apellidos sin acentos ni
 * mayúsculas. Si hay dos fichas con ese nombre manda la activa; si siguen siendo varias,
 * `ambiguo` y que lo decida una persona (el sync lo avisa en vez de adivinar).
 */
export function resolverTitular(texto: string, profes: readonly ProfeParaTitular[]): ResultadoTitular {
  const buscado = normalizar(texto);
  if (!buscado) return { tipo: 'ninguno' };
  const iguales = profes.filter((p) => nombreCompletoNorm(p) === buscado);
  const activos = iguales.filter((p) => p.active);
  const elegidos = activos.length > 0 ? activos : iguales;
  if (elegidos.length === 0) return { tipo: 'ninguno' };
  if (elegidos.length > 1) return { tipo: 'ambiguo', ids: elegidos.map((p) => p.id) };
  return { tipo: 'ok', id: elegidos[0].id };
}

export interface SustitucionExistente extends SustitucionBase {
  id: string;
  origen: string;
}

export interface PlanSustituciones {
  crear: { sustitutoId: string; titularId: string; desde: string | null; hasta: string | null }[];
  /** Las de origen `educamos` cuyas fechas han cambiado. */
  actualizar: { id: string; desde: string | null; hasta: string | null }[];
  /** Las de origen `educamos` que Educamos ya no cuenta (ya no es sustituto o cambió de titular): se apagan. */
  apagar: string[];
  avisos: string[];
}

/**
 * Qué hay que hacer en `edu_sustituciones` para que refleje lo que dice Educamos.
 *
 *  - Solo cuentan sustitutos **que siguen en curso** (sin baja, o con baja de hoy en adelante):
 *    el histórico de sustitutos de años anteriores no aporta nada y ensuciaría la lista.
 *  - Lo **manual** no se toca nunca; si ya hay una manual para el mismo par, la de Educamos no
 *    se crea encima.
 *  - Lo **apagado a mano** no se reactiva: el sync actualiza fechas, no el interruptor.
 *  - Un titular que no se encuentra (o hay dos con ese nombre) se avisa y no se inventa.
 */
export function planSustitucionesEducamos(
  candidatos: readonly CandidatoSustituto[],
  profes: readonly ProfeParaTitular[],
  existentes: readonly SustitucionExistente[],
  hoy: string,
): PlanSustituciones {
  const plan: PlanSustituciones = { crear: [], actualizar: [], apagar: [], avisos: [] };
  const nombrePorId = new Map(profes.map((p) => [p.id, [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ')]));
  const nombreDe = (id: string) => nombrePorId.get(id) ?? 'alguien';

  for (const c of candidatos) {
    const suyas = existentes.filter((e) => e.sustitutoId === c.sustitutoId && e.origen === 'educamos');
    const deseados = new Set<string>();

    const sigueEnCurso = !c.hasta || c.hasta >= hoy;
    if (c.esSustituto && c.titularTexto && sigueEnCurso) {
      const r = resolverTitular(c.titularTexto, profes);
      if (r.tipo === 'ninguno') {
        plan.avisos.push(`${nombreDe(c.sustitutoId)} figura como sustituto/a de «${c.titularTexto}», pero no hay nadie con ese nombre en el profesorado. Apúntalo a mano en Profesorado → Sustituciones.`);
      } else if (r.tipo === 'ambiguo') {
        plan.avisos.push(`${nombreDe(c.sustitutoId)} figura como sustituto/a de «${c.titularTexto}», pero hay ${r.ids.length} fichas con ese nombre. Apúntalo a mano en Profesorado → Sustituciones.`);
      } else if (r.id === c.sustitutoId) {
        plan.avisos.push(`${nombreDe(c.sustitutoId)} figura como sustituto/a de sí mismo/a; se ignora.`);
      } else {
        deseados.add(r.id);
        const hecha = existentes.find((e) => e.sustitutoId === c.sustitutoId && e.titularId === r.id);
        if (!hecha) {
          plan.crear.push({ sustitutoId: c.sustitutoId, titularId: r.id, desde: c.desde, hasta: c.hasta });
        } else if (hecha.origen === 'educamos' && (hecha.desde !== c.desde || hecha.hasta !== c.hasta)) {
          plan.actualizar.push({ id: hecha.id, desde: c.desde, hasta: c.hasta });
        }
      }
    }

    // Lo que Educamos contaba antes y ya no: se apaga (queda en la lista, como histórico).
    for (const e of suyas) {
      if (!deseados.has(e.titularId) && e.activa) plan.apagar.push(e.id);
    }
  }
  return plan;
}
