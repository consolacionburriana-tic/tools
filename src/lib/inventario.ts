// Inventario y aulas: helpers puros (sin IO). Ficha: docs/33-inventario.md.
//
// El aula es el sitio físico y se conoce por el número de su puerta; la clase que la ocupa
// cambia cada curso. Aquí viven los nombres de las cosas, cómo se ordena lo que pide atención,
// la cuenta de mesas y sillas contra el alumnado, el aviso de inicio de curso, la sugerencia de
// qué clase va en cada aula el curso que viene y los códigos de los kits de robótica.
import { z } from 'zod';
import { CONFIGURACION } from './configuracion';
import { compararClases, cursoSiguiente, etapaDeCurso, nombreClase } from './cursos';

// ─── Vocabulario ─────────────────────────────────────────────────────────────

export const PISOS = ['PB', 'P1', 'P2', 'P3'] as const;
export type Piso = (typeof PISOS)[number];
export const PISO_LABEL: Record<Piso, string> = { PB: 'Planta baja', P1: 'Primer piso', P2: 'Segundo piso', P3: 'Tercer piso' };

export function etiquetaPiso(piso: string | null | undefined): string {
  if (!piso) return 'Sin piso';
  return (PISO_LABEL as Record<string, string>)[piso] ?? piso;
}

export const PANTALLAS = ['proyector', 'tv', 'ninguna'] as const;
export type Pantalla = (typeof PANTALLAS)[number];
export const PANTALLA_LABEL: Record<Pantalla, string> = { proyector: 'Proyector', tv: 'TV', ninguna: 'Sin pantalla' };

export const AUDIOS = ['altavoz_grande', 'altavoces_pequenos', 'pantalla', 'tv', 'ninguno'] as const;
export type Audio = (typeof AUDIOS)[number];
export const AUDIO_LABEL: Record<Audio, string> = {
  altavoz_grande: 'Altavoz grande',
  altavoces_pequenos: 'Altavoces pequeños',
  pantalla: 'De la pantalla',
  tv: 'De la TV',
  ninguno: 'Sin audio',
};

/** Cómo está el audiovisual de un aula: lo que decía la columna «Acciones» del Excel. */
export const ACCIONES_AV = ['correcto', 'audio', 'retirar', 'reparar', 'cambiar'] as const;
export type AccionAv = (typeof ACCIONES_AV)[number];
export const ACCION_AV_LABEL: Record<AccionAv, string> = {
  correcto: 'Correcto',
  audio: 'Problema de audio',
  retirar: 'Retirar lo antiguo',
  reparar: 'Reparar',
  cambiar: 'Cambiar',
};
export const ACCION_AV_TONO: Record<AccionAv, 'ok' | 'aviso' | 'error' | 'neutro'> = {
  correcto: 'ok',
  audio: 'aviso',
  retirar: 'neutro',
  reparar: 'error',
  cambiar: 'error',
};

export const AREAS = ['av', 'mobiliario', 'red', 'robotica', 'otro'] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = {
  av: 'Audiovisual',
  mobiliario: 'Mobiliario',
  red: 'Wifi y red',
  robotica: 'Robótica',
  otro: 'Otro',
};

export const PRIORIDADES = ['urgente', 'normal', 'baja'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];
export const PRIORIDAD_LABEL: Record<Prioridad, string> = { urgente: 'Urgente', normal: 'Normal', baja: 'Cuando se pueda' };
export const PRIORIDAD_PESO: Record<Prioridad, number> = { urgente: 0, normal: 1, baja: 2 };

export const CATEGORIAS_ROB = ['robot', 'electronica', 'tapete', 'accesorio', 'fabricacion', 'mobiliario', 'otro'] as const;
export type CategoriaRob = (typeof CATEGORIAS_ROB)[number];
export const CATEGORIA_ROB_LABEL: Record<CategoriaRob, string> = {
  robot: 'Robots',
  electronica: 'Electrónica y placas',
  tapete: 'Tapetes',
  accesorio: 'Accesorios y recambios',
  fabricacion: 'Impresión 3D y láser',
  mobiliario: 'Mobiliario',
  otro: 'Otro',
};

export const ESTADOS_KIT = ['ok', 'incompleto', 'averiado', 'baja'] as const;
export type EstadoKit = (typeof ESTADOS_KIT)[number];
export const ESTADO_KIT_LABEL: Record<EstadoKit, string> = { ok: 'Bien', incompleto: 'Le falta algo', averiado: 'Averiado', baja: 'De baja' };
export const ESTADO_KIT_TONO: Record<EstadoKit, 'ok' | 'aviso' | 'error' | 'neutro'> = {
  ok: 'ok',
  incompleto: 'aviso',
  averiado: 'error',
  baja: 'neutro',
};

// ─── Aulas ───────────────────────────────────────────────────────────────────

export interface AulaBase {
  numero: string | null;
  nombre: string | null;
  orden: number;
}

/** «Aula 12», «Aula de Música (15)», «Informática». */
export function nombreAula(a: Pick<AulaBase, 'numero' | 'nombre'>): string {
  if (a.nombre && a.numero) return `${a.nombre} (${a.numero})`;
  if (a.nombre) return a.nombre;
  return `Aula ${a.numero ?? '?'}`;
}

/** El número que se escribe en la puerta, para ordenar: 17 en '17-18'; sin número, al final. */
export function ordenDeNumero(numero: string | null | undefined): number {
  const m = (numero ?? '').match(/\d+/);
  return m ? Number(m[0]) : 900;
}

export function compararAulas(a: AulaBase, b: AulaBase): number {
  return a.orden - b.orden || (a.numero ?? a.nombre ?? '').localeCompare(b.numero ?? b.nombre ?? '', 'es', { numeric: true });
}

/** Clave de una clase para mapas: '3PRI|B'. */
export function claveClase(curso: string, letra: string | null | undefined): string {
  return `${curso}|${letra ?? ''}`;
}

export function deClave(clave: string): { curso: string; letra: string | null } {
  const [curso, letra] = clave.split('|');
  return { curso, letra: letra || null };
}

/** Lo que se lee en la puerta: «3PRI B» → «3º EP B», «3ºPPDC» → «3º PDC». */
export function cartelClase(curso: string | null | undefined, letra: string | null | undefined): string {
  if (!curso) return '';
  const n = curso.match(/^\d+/)?.[0] ?? '';
  const etapa = etapaDeCurso(curso);
  if (/PDC/i.test(curso) || letra === 'PDC') return `${n}º ESO PDC`;
  const sufijo = etapa === 'EI' ? `${n} años` : etapa === 'EP' ? `${n}º EP` : etapa === 'ESO' ? `${n}º ESO` : nombreClase(curso, null);
  return letra ? `${sufijo} ${letra}` : sufijo;
}

// ─── Audiovisual: qué pide atención ──────────────────────────────────────────

export type NivelAtencion = 'urgente' | 'alta' | 'media' | 'ok';
export const NIVEL_LABEL: Record<NivelAtencion, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Media', ok: 'Bien' };
export const NIVEL_TONO: Record<NivelAtencion, 'error' | 'aviso' | 'neutro' | 'ok'> = { urgente: 'error', alta: 'error', media: 'aviso', ok: 'ok' };
const NIVEL_PESO: Record<NivelAtencion, number> = { urgente: 0, alta: 1, media: 2, ok: 3 };

interface ArregloMin {
  prioridad: string;
  hecho: boolean;
}

/**
 * Prioridad del audiovisual de un aula, para ordenar la tabla por «lo primero que hay que
 * arreglar»: un arreglo urgente sin hacer manda; luego «Cambiar»/«Reparar» o una valoración de 0-1;
 * luego un problema de audio, lo antiguo por retirar, una valoración de 2-3 o un arreglo pendiente que no sea «cuando se pueda».
 */
export function atencionAv(
  av: { accion: string; valoracion: number | null } | null,
  arreglos: readonly ArregloMin[] = [],
): NivelAtencion {
  const pendientes = arreglos.filter((a) => !a.hecho);
  // Lo de «cuando se pueda» (quitar un proyector viejo que ya no se usa) no sube la prioridad del aula.
  const importantes = pendientes.filter((a) => a.prioridad !== 'baja');
  if (pendientes.some((a) => a.prioridad === 'urgente')) return 'urgente';
  if (!av) return importantes.length ? 'media' : 'ok';
  const v = av.valoracion;
  if (av.accion === 'cambiar' || av.accion === 'reparar' || (v !== null && v <= 1)) return 'alta';
  if (av.accion === 'audio' || av.accion === 'retirar' || (v !== null && v <= 3) || importantes.length > 0) return 'media';
  return 'ok';
}

/** Para ordenar por atención: el nivel y, a igualdad, la peor valoración primero (sin valorar, al final). */
export function pesoAtencion(nivel: NivelAtencion, valoracion: number | null): number {
  return NIVEL_PESO[nivel] * 10 + (valoracion ?? 6);
}

// ─── Mesas y sillas contra el alumnado ───────────────────────────────────────

export interface Cuadre {
  /** Sillas − alumnos (negativo = faltan). Null si no se sabe una de las dos. */
  sillas: number | null;
  /** Mesas − alumnos. Null si no se sabe, o en Infantil (allí las mesas son de grupo). */
  mesas: number | null;
}

export function cuadreMobiliario(
  mob: { sillas: number | null; mesas: number | null } | null,
  alumnos: number | null,
  curso: string | null,
): Cuadre {
  if (!mob || alumnos === null || alumnos === 0) return { sillas: null, mesas: null };
  const infantil = etapaDeCurso(curso) === 'EI';
  return {
    sillas: mob.sillas === null ? null : mob.sillas - alumnos,
    mesas: mob.mesas === null || infantil ? null : mob.mesas - alumnos,
  };
}

/** «Faltan 2», «Sobran 3», «Justas»; con la cosa, «Falta 1 silla», «Faltan 3 sillas». */
export function textoCuadre(d: number, cosa?: 'silla' | 'mesa'): string {
  const n = Math.abs(d);
  const que = cosa ? ` ${n === 1 ? cosa : `${cosa}s`}` : '';
  if (d < 0) return `${n === 1 ? 'Falta' : 'Faltan'} ${n}${que}`;
  if (d > 0) return `${n === 1 ? 'Sobra' : 'Sobran'} ${n}${que}`;
  return cosa ? `${cosa === 'silla' ? 'Sillas' : 'Mesas'} justas` : 'Justas';
}

// ─── Antenas ─────────────────────────────────────────────────────────────────

export function antenaPorRenombrar(a: { nombreActual: string; nombreNuevo: string | null }): boolean {
  return Boolean(a.nombreNuevo && a.nombreNuevo.trim() && a.nombreNuevo.trim() !== a.nombreActual.trim());
}

/**
 * El nombre que le toca a la antena de un aula según la norma del cole (`P2_15`: piso y número de
 * la puerta, el primero si son dos, `17-18` → `P2_17`).
 */
export function nombreAntenaDeAula(a: { piso: string | null; numero: string | null }): string | null {
  if (!a.piso || !a.numero) return null;
  return `${a.piso}_${ordenDeNumero(a.numero)}`;
}

// ─── Aviso de inicio de curso ────────────────────────────────────────────────

/** '2027-28' a partir del año en que empieza. */
export function cursoAcademicoDesde(inicio: number): string {
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/** El curso anterior a uno: '2027-28' → '2026-27'. */
export function cursoAnterior(year: string): string {
  return cursoAcademicoDesde(Number(year.slice(0, 4)) - 1);
}

/** El siguiente: '2026-27' → '2027-28'. */
export function cursoPosterior(year: string): string {
  return cursoAcademicoDesde(Number(year.slice(0, 4)) + 1);
}

/**
 * ¿Toca avisar de que hay que ajustar las clases del curso que viene? Del 10 de julio al 30 de
 * septiembre (`CONFIGURACION.inventario`), mientras no esté hecho. `hoy` es 'YYYY-MM-DD' del colegio.
 * Devuelve el curso que hay que preparar, o null si no toca avisar.
 */
export function avisoAjusteCursos(hoy: string, hecho: (destino: string) => boolean): string | null {
  const { avisoCursosDesde, avisoCursosHasta } = CONFIGURACION.inventario;
  const mmdd = hoy.slice(5);
  if (mmdd < avisoCursosDesde || mmdd > avisoCursosHasta) return null;
  const destino = cursoAcademicoDesde(Number(hoy.slice(0, 4)));
  return hecho(destino) ? null : destino;
}

/** El curso que se ajusta por defecto: el que viene desde el 10 de julio; antes, el actual. */
export function cursoParaAjustar(hoy: string, actual: string): string {
  return hoy.slice(5) >= CONFIGURACION.inventario.avisoCursosDesde && hoy.slice(5) < '09-01' ? cursoPosterior(actual) : actual;
}

// ─── Qué clase va en cada aula el curso que viene ────────────────────────────

export interface ClaseEnAula {
  curso: string;
  letra: string | null;
}

export interface Sugerencia {
  aulaId: string;
  clase: ClaseEnAula | null;
  etiqueta: string | null;
  motivo: string;
  /** 'tutor' = sigue a su tutor/a (lo más fiable) · 'regla' = por cómo promociona la etapa · 'mantener' = sala fija o sin clase · 'revisar' = no se sabe. */
  fuente: 'tutor' | 'regla' | 'mantener' | 'revisar';
}

const MOTIVO_REGLA: Record<string, string> = {
  rota: 'Infantil rota 3-4-5 y el aula sigue con su tutora',
  parejas: 'Primaria va por ciclos: el aula sigue con su tutor/a',
  sube: 'Sube de curso en la misma aula (compruébalo)',
};

/**
 * Propone qué clase irá en cada aula el curso que viene, a partir de la de este curso:
 *   1. Si las tutorías del curso que viene ya están, la clase que tendrá su tutor/a (lo que pasa
 *      «si mantiene el tutor, que es lo habitual», David).
 *   2. Si no, la regla de promoción de la etapa (`cursoSiguiente`): Infantil 5→3, Primaria por
 *      parejas (3→4, 4→3), ESO sube.
 *   3. 4º de ESO no tiene a dónde ir: queda para elegir.
 * Una clase propuesta para dos aulas se marca en las dos para revisar.
 */
export function sugerirOcupacion(
  aulas: readonly { id: string; actual: { curso: string | null; letra: string | null; etiqueta: string | null } | null }[],
  tutoresDe: (clase: ClaseEnAula) => readonly string[],
  clasesDeTutorDestino: (tutorId: string) => readonly ClaseEnAula[],
  nombreTutor: (tutorId: string) => string,
): Sugerencia[] {
  const out: Sugerencia[] = aulas.map((a) => {
    const act = a.actual;
    if (!act) return { aulaId: a.id, clase: null, etiqueta: null, motivo: 'Este curso no tiene clase', fuente: 'mantener' };
    if (!act.curso) return { aulaId: a.id, clase: null, etiqueta: act.etiqueta ?? null, motivo: 'Se queda como está', fuente: 'mantener' };
    const clase = { curso: act.curso, letra: act.letra };
    const tutores = tutoresDe(clase);
    const destinos = new Map<string, { clase: ClaseEnAula; tutor: string }>();
    for (const t of tutores) for (const c of clasesDeTutorDestino(t)) destinos.set(claveClase(c.curso, c.letra), { clase: c, tutor: t });
    if (destinos.size === 1) {
      const [d] = destinos.values();
      return { aulaId: a.id, clase: d.clase, etiqueta: null, motivo: `Sigue su tutor/a, ${nombreTutor(d.tutor)}`, fuente: 'tutor' };
    }
    const sig = cursoSiguiente(clase.curso);
    const etapa = etapaDeCurso(clase.curso);
    if (sig) {
      const tipo = etapa ? CONFIGURACION.promocion[etapa] : 'sube';
      return { aulaId: a.id, clase: { curso: sig, letra: clase.letra }, etiqueta: null, motivo: MOTIVO_REGLA[tipo], fuente: tipo === 'sube' ? 'revisar' : 'regla' };
    }
    return { aulaId: a.id, clase: null, etiqueta: null, motivo: `${cartelClase(clase.curso, clase.letra)} termina: elige qué clase entra`, fuente: 'revisar' };
  });
  const usos = new Map<string, number>();
  for (const s of out) if (s.clase) usos.set(claveClase(s.clase.curso, s.clase.letra), (usos.get(claveClase(s.clase.curso, s.clase.letra)) ?? 0) + 1);
  return out.map((s) =>
    s.clase && (usos.get(claveClase(s.clase.curso, s.clase.letra)) ?? 0) > 1
      ? { ...s, fuente: 'revisar', motivo: `${s.motivo} · sale en dos aulas` }
      : s,
  );
}

/** Clases repetidas en un reparto (la misma clase en dos aulas). */
export function clasesRepetidas(reparto: readonly { clase: ClaseEnAula | null }[]): Set<string> {
  const vistos = new Set<string>();
  const repes = new Set<string>();
  for (const r of reparto) {
    if (!r.clase) continue;
    const k = claveClase(r.clase.curso, r.clase.letra);
    if (vistos.has(k)) repes.add(k);
    vistos.add(k);
  }
  return repes;
}

/** Ordena una lista de claves de clase por etapa, curso y letra. */
export function ordenarClaves(claves: Iterable<string>): string[] {
  return [...new Set(claves)].sort((a, b) => compararClases(deClave(a), deClave(b)));
}

// ─── Robótica ────────────────────────────────────────────────────────────────

/** Los `n` siguientes códigos libres con un prefijo: con L1-L4 ya puestos, `L5`, `L6`… */
export function siguientesCodigos(prefijo: string, existentes: readonly string[], n: number): string[] {
  const p = prefijo.trim().toUpperCase();
  const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i');
  const usados = new Set(existentes.map((c) => c.toUpperCase()));
  let max = 0;
  for (const c of existentes) {
    const m = c.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const out: string[] = [];
  let i = max + 1;
  while (out.length < n) {
    const c = `${p}${i}`;
    if (!usados.has(c)) out.push(c);
    i++;
  }
  return out;
}

/** Un prefijo para empezar a numerar: las iniciales del nombre («Codey Rocky» → «CR»). */
export function prefijoSugerido(nombre: string): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(de|del|la|el|con|para|y|kit|robot|set|pack)$/i.test(w));
  const p = palabras
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return p || 'K';
}

export type EstadoPedido = 'sin_pedir' | 'falta_todo' | 'parcial' | 'completo';
export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  sin_pedir: 'Sin pedir',
  falta_todo: 'No ha llegado',
  parcial: 'Llegado en parte',
  completo: 'Todo recibido',
};

export function estadoPedido(pedidas: number | null, recibidas: number): EstadoPedido {
  if (pedidas === null || pedidas <= 0) return recibidas > 0 ? 'completo' : 'sin_pedir';
  if (recibidas === 0) return 'falta_todo';
  return recibidas >= pedidas ? 'completo' : 'parcial';
}

/** Normaliza un enlace pegado: sin protocolo, se le pone https. Vacío → null. */
export function normalizarUrl(url: string | null | undefined): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** Un título para un enlace sin título: el dominio sin `www.`. */
export function tituloDeUrl(url: string): string {
  try {
    return new URL(normalizarUrl(url) ?? url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Busca sin acentos ni mayúsculas. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ─── Lo que entra por la red ─────────────────────────────────────────────────

const texto = (max: number) =>
  z
    .string()
    .max(max, `Como mucho ${max} caracteres`)
    .transform((s) => s.trim())
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional()
    .transform((s) => s ?? null);
const id = z.string().uuid();
const entero = z.number().int().min(0).max(999).nullable();

export const aulaSchema = z.object({
  id: id.optional(),
  numero: texto(20),
  piso: z.enum(PISOS).nullable(),
  nombre: texto(80),
  notas: texto(2000),
});
export type AulaInput = z.infer<typeof aulaSchema>;

export const avSchema = z.object({
  aulaId: id,
  pantalla: z.enum(PANTALLAS).nullable(),
  marca: texto(80),
  audio: z.enum(AUDIOS).nullable(),
  appleTv: z.boolean(),
  valoracion: z.number().int().min(0).max(5).nullable(),
  accion: z.enum(ACCIONES_AV),
  notas: texto(2000),
});
export type AvInput = z.infer<typeof avSchema>;

export const mobiliarioSchema = z.object({
  aulaId: id,
  sillas: entero,
  mesas: entero,
  notas: texto(2000),
});
export type MobiliarioInput = z.infer<typeof mobiliarioSchema>;

export const antenaSchema = z.object({
  id: id.optional(),
  nombreActual: z.string().trim().min(1, 'Falta el nombre de la antena').max(60),
  nombreNuevo: texto(60),
  aulaId: id.nullable(),
  piso: z.enum(PISOS).nullable(),
  ubicacion: texto(120),
  notas: texto(1000),
});
export type AntenaInput = z.infer<typeof antenaSchema>;

export const arregloSchema = z.object({
  id: id.optional(),
  aulaId: id.nullable(),
  kitId: id.nullable(),
  area: z.enum(AREAS),
  texto: z.string().trim().min(1, 'Escribe qué hay que arreglar').max(500),
  prioridad: z.enum(PRIORIDADES),
});
export type ArregloInput = z.infer<typeof arregloSchema>;

export const ocupacionSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  reparto: z
    .array(
      z.object({
        aulaId: id,
        curso: z.string().max(20).nullable(),
        letra: z.string().max(10).nullable(),
        etiqueta: texto(60),
      }),
    )
    .max(200),
});
export type OcupacionInput = z.infer<typeof ocupacionSchema>;

export const modeloSchema = z.object({
  id: id.optional(),
  nombre: z.string().trim().min(1, 'Falta el nombre').max(120),
  codigoArticulo: texto(40),
  categoria: z.enum(CATEGORIAS_ROB),
  pedidas: entero,
  prefijo: texto(8),
  notas: texto(2000),
});
export type ModeloInput = z.infer<typeof modeloSchema>;

export const recibirSchema = z.object({
  modeloId: id,
  cantidad: z.number().int().min(1).max(100),
  prefijo: z
    .string()
    .trim()
    .min(1, 'Falta el prefijo (L para L1, L2…)')
    .max(8)
    .regex(/^[A-Za-z0-9-]+$/, 'El prefijo, solo letras y números'),
  aulaId: id.nullable(),
});
export type RecibirInput = z.infer<typeof recibirSchema>;

export const kitSchema = z.object({
  id,
  codigo: z.string().trim().min(1, 'Falta el código').max(20),
  aulaId: id.nullable(),
  estado: z.enum(ESTADOS_KIT),
  notas: texto(2000),
});
export type KitInput = z.infer<typeof kitSchema>;

export const recursoSchema = z.object({
  modeloId: id,
  titulo: texto(160),
  url: texto(1000),
  notas: texto(1000),
});
export type RecursoInput = z.infer<typeof recursoSchema>;
