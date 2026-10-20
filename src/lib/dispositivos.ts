// Dispositivos 1:1: helpers puros (sin IO). Ficha: docs/29-dispositivos.md.
//
// Lo que se decide sin tocar la BBDD: los estados de un alumno (comprado, de casa, prestado,
// de hermano), el seguro de 4 cursos y lo que paga cada uno, los códigos de los iPads del cole
// (A1, S1, P1…) y los schemas de lo que entra por la red.
import { z } from 'zod';
import { CONFIGURACION } from '@/lib/configuracion';
import { cursoBaseEso, ordenCurso, type Etapa } from '@/lib/cursos';

// ─── Catálogos ────────────────────────────────────────────────────────────────

/** Las pestañas del panel (`?vista=`). Aquí y no en el componente: la lee también la página. */
export const VISTAS = ['alumnado', 'cuotas', 'cole', 'modelos'] as const;
export type Vista = (typeof VISTAS)[number];

/** Tipos de dispositivo. Hoy solo iPad; el día que entre otro, se añade aquí. */
export const TIPOS = ['ipad'] as const;
export type Tipo = (typeof TIPOS)[number];
export const TIPO_LABEL: Record<Tipo, string> = { ipad: 'iPad' };

/** Cómo tiene el dispositivo un alumno. «Sin informar» es no tener fila. */
export const MODALIDADES = ['comprado', 'casa', 'prestado', 'hermano'] as const;
export type Modalidad = (typeof MODALIDADES)[number];
export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  comprado: 'Comprado',
  casa: 'De casa',
  prestado: 'Prestado',
  hermano: 'De hermano',
};

export function esModalidad(valor: unknown): valor is Modalidad {
  return typeof valor === 'string' && (MODALIDADES as readonly string[]).includes(valor);
}

/** Las modalidades que llevan curso de compra (y por tanto seguro). */
export function llevaCompra(m: Modalidad | null | undefined): boolean {
  return m === 'comprado' || m === 'hermano';
}

/** Para qué es un iPad del cole. Cada uso tiene su letra en el código. */
export const USOS = ['prestamo', 'sustitucion', 'profesorado'] as const;
export type Uso = (typeof USOS)[number];
export const USO_LABEL: Record<Uso, string> = {
  prestamo: 'Préstamo',
  sustitucion: 'Sustitución',
  profesorado: 'Profesorado',
};
export const USO_EXPLICA: Record<Uso, string> = {
  prestamo: 'Los que el cole presta a un alumno para todo el curso',
  sustitucion: 'Para dejar mientras el de un alumno está en reparación',
  profesorado: 'Los del claustro, desde el 3er ciclo de Primaria',
};
/** S y P los fijó David (20-oct-2026); la A de préstamo es nuestra («de alumnado»). */
export const PREFIJO: Record<Uso, string> = { prestamo: 'A', sustitucion: 'S', profesorado: 'P' };

export function esUso(valor: unknown): valor is Uso {
  return typeof valor === 'string' && (USOS as readonly string[]).includes(valor);
}

/** El estado físico del aparato. Quién lo tiene va aparte (`titular`). */
export const ESTADOS_APARATO = ['activo', 'reparacion', 'baja'] as const;
export type EstadoAparato = (typeof ESTADOS_APARATO)[number];
export const ESTADO_APARATO_LABEL: Record<EstadoAparato, string> = {
  activo: 'Operativo',
  reparacion: 'En reparación',
  baja: 'De baja',
};

// ─── Cursos escolares ─────────────────────────────────────────────────────────

const RE_CURSO = /^(\d{4})-(\d{2})$/;

/** ¿Es un curso escolar bien escrito y seguido? «2022-23» sí; «2022-24» o «22-23», no. */
export function esCursoEscolar(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = valor.match(RE_CURSO);
  return Boolean(m && (Number(m[1]) + 1) % 100 === Number(m[2]));
}

/** «2022-23» → 2022. */
export function inicioDeCurso(curso: string): number {
  return Number(curso.slice(0, 4));
}

/** 2022 → «2022-23». */
export function cursoDesdeInicio(inicio: number): string {
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/** Los cursos que se ofrecen como «curso de compra»: el actual y los anteriores, del más nuevo al más viejo. */
export function cursosDeCompra(cursoActual: string, hacia_atras = 8): string[] {
  const inicio = inicioDeCurso(cursoActual);
  return Array.from({ length: hacia_atras + 1 }, (_, i) => cursoDesdeInicio(inicio - i));
}

// ─── Seguro y cuotas ──────────────────────────────────────────────────────────

export type EstadoSeguro = 'vigente' | 'ultimo' | 'vencido' | 'sin_dato';

export interface Seguro {
  estado: EstadoSeguro;
  /** Último curso cubierto («2025-26»), o null si no se sabe el de compra. */
  hasta: string | null;
}

/**
 * El seguro de un iPad comprado a través del cole cubre `cursosSeguro` cursos escolares, el de
 * compra incluido (David, 20-oct-2026: «4 años por curso escolar, obvio»). Comprado en 2022-23
 * cubre hasta 2025-26, y en 2026-27 ya ha vencido.
 */
export function seguroDe(cursoCompra: string | null | undefined, cursoActual: string): Seguro {
  if (!esCursoEscolar(cursoCompra)) return { estado: 'sin_dato', hasta: null };
  const ultimo = inicioDeCurso(cursoCompra) + CONFIGURACION.dispositivos.cursosSeguro - 1;
  const hasta = cursoDesdeInicio(ultimo);
  const actual = inicioDeCurso(cursoActual);
  if (actual > ultimo) return { estado: 'vencido', hasta };
  if (actual === ultimo) return { estado: 'ultimo', hasta };
  return { estado: 'vigente', hasta };
}

/** Lo mínimo de un alumno para decidir qué paga. */
export interface EstadoBasico {
  modalidad: Modalidad;
  cursoCompra: string | null;
  aCasa: boolean | null;
}

export type Concepto = 'mensual' | 'anual';
export const CONCEPTO_LABEL: Record<Concepto, string> = {
  mensual: `${CONFIGURACION.dispositivos.cuotaMensual} € al mes`,
  anual: `${CONFIGURACION.dispositivos.cuotaAnualSinSeguro} € al año`,
};

export interface Cuota {
  /** null = no paga nada. */
  concepto: Concepto | null;
  importe: number;
  /** Por qué, en palabras: «Lo trae de casa», «Comprado en 2022-23 · seguro vencido». */
  motivo: string;
  /** Falta un dato para saberlo (el curso de compra). Cuenta como «no paga» hasta que se sepa. */
  aviso: string | null;
}

/**
 * Qué paga un alumno según cómo tiene el iPad (Jose Miguel, 13-oct-2026):
 * - comprado o de hermano: nada con el seguro en vigor; `cuotaAnualSinSeguro` cuando vence;
 * - de casa: `cuotaMensual`;
 * - prestado que se lo lleva a casa: `cuotaMensual`; si se queda en el cole, nada.
 */
export function cuotaDe(e: EstadoBasico, cursoActual: string): Cuota {
  const { cuotaMensual, cuotaAnualSinSeguro } = CONFIGURACION.dispositivos;
  switch (e.modalidad) {
    case 'casa':
      return { concepto: 'mensual', importe: cuotaMensual, motivo: 'Lo trae de casa', aviso: null };
    case 'prestado':
      return e.aCasa
        ? { concepto: 'mensual', importe: cuotaMensual, motivo: 'Prestado por el cole · se lo lleva a casa', aviso: null }
        : { concepto: null, importe: 0, motivo: 'Prestado por el cole · se queda en el cole', aviso: null };
    case 'comprado':
    case 'hermano': {
      const de = e.modalidad === 'hermano' ? 'De un hermano' : 'Comprado';
      const seguro = seguroDe(e.cursoCompra, cursoActual);
      if (seguro.estado === 'sin_dato') {
        return { concepto: null, importe: 0, motivo: de, aviso: 'Falta el curso de compra' };
      }
      if (seguro.estado === 'vencido') {
        return { concepto: 'anual', importe: cuotaAnualSinSeguro, motivo: `${de} en ${e.cursoCompra} · seguro vencido`, aviso: null };
      }
      return { concepto: null, importe: 0, motivo: `${de} en ${e.cursoCompra} · seguro hasta ${seguro.hasta}`, aviso: null };
    }
  }
}

/** Lo único que ven tutores y profes: que NO se lo lleva a casa (David, 20-oct-2026). */
export function noSeLoLlevaACasa(e: Pick<EstadoBasico, 'modalidad' | 'aCasa'> | null | undefined): boolean {
  return Boolean(e && e.modalidad === 'prestado' && !e.aCasa);
}

/** «Comprado · 2022-23 · seguro vencido», «Prestado A12 · a casa», «De casa». */
export function textoEstado(
  e: EstadoBasico & { aparato?: string | null },
  cursoActual: string,
): string {
  switch (e.modalidad) {
    case 'casa':
      return 'De casa';
    case 'prestado':
      return ['Prestado', e.aparato ?? null].filter(Boolean).join(' ') + (e.aCasa ? ' · a casa' : ' · en el cole');
    case 'comprado':
    case 'hermano': {
      const s = seguroDe(e.cursoCompra, cursoActual);
      const base = `${MODALIDAD_LABEL[e.modalidad]}`;
      if (s.estado === 'sin_dato') return `${base} · sin curso de compra`;
      return `${base} · ${e.cursoCompra} · ${TEXTO_SEGURO[s.estado]}`;
    }
  }
}

export const TEXTO_SEGURO: Record<EstadoSeguro, string> = {
  vigente: 'con seguro',
  ultimo: 'último curso con seguro',
  vencido: 'seguro vencido',
  sin_dato: 'sin curso de compra',
};

export interface ResumenCuotas {
  mensual: { n: number; total: number };
  anual: { n: number; total: number };
  /** Los que no pagan (seguro en vigor, prestado en el cole). */
  nada: number;
  /** Les falta un dato para saber qué pagan. */
  avisos: number;
}

export function resumenCuotas(cuotas: readonly Cuota[]): ResumenCuotas {
  const r: ResumenCuotas = { mensual: { n: 0, total: 0 }, anual: { n: 0, total: 0 }, nada: 0, avisos: 0 };
  for (const c of cuotas) {
    if (c.aviso) r.avisos++;
    else if (c.concepto) {
      r[c.concepto].n++;
      r[c.concepto].total += c.importe;
    } else r.nada++;
  }
  return r;
}

// ─── Códigos de los iPads del cole ────────────────────────────────────────────

/** El número de un código de ese uso («S12» → 12), o null si no es de ese uso. */
export function numeroDeCodigo(uso: Uso, codigo: string): number | null {
  const m = codigo.trim().toUpperCase().match(new RegExp(`^${PREFIJO[uso]}(\\d+)$`));
  return m ? Number(m[1]) : null;
}

/** Los `n` códigos libres siguientes de un uso: tras el más alto que haya («S7» → S8, S9…). */
export function siguientesCodigos(uso: Uso, existentes: readonly string[], n = 1): string[] {
  const max = existentes.reduce((acc, c) => Math.max(acc, numeroDeCodigo(uso, c) ?? 0), 0);
  return Array.from({ length: n }, (_, i) => `${PREFIJO[uso]}${max + i + 1}`);
}

/** Orden natural de códigos: A2 antes que A10, y por letra primero. */
export function compararCodigos(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

/** Un código escrito a mano: letras y números, sin espacios, en mayúsculas. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, '');
}

/** Lo pegado de una columna de Excel: un nº de serie por línea, sin vacíos ni repetidos. */
export function parsearSeries(texto: string): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const linea of texto.split(/[\r\n]+/)) {
    const s = linea.trim().replace(/\s+/g, '').toUpperCase();
    if (!s || vistos.has(s)) continue;
    vistos.add(s);
    lista.push(s);
  }
  return lista;
}

/** «iPad (9.ª generación) · 64 GB». */
export function etiquetaModelo(m: { nombre: string; capacidadGb: number | null } | null | undefined): string {
  if (!m) return '';
  return m.capacidadGb ? `${m.nombre} · ${m.capacidadGb} GB` : m.nombre;
}

// ─── Profesorado ──────────────────────────────────────────────────────────────

/**
 * ¿Le toca iPad del cole a este profe? Desde el 3er ciclo de Primaria (David, 20-oct-2026):
 * tiene clase o tutoría de 5º EP para arriba, o tiene la ESO (o Bachillerato) en su ficha.
 */
export function profeLeToca(cursos: readonly (string | null)[], etapas: readonly (Etapa | string)[]): boolean {
  if (etapas.includes('ESO') || etapas.includes('BACH')) return true;
  const desde = ordenCurso(CONFIGURACION.dispositivos.profesDesdeCurso);
  return cursos.some((c) => Boolean(c) && ordenCurso(cursoBaseEso(c)) >= desde);
}

// ─── Lo que entra por la red ──────────────────────────────────────────────────

const cursoCompraSchema = z
  .string()
  .refine((v) => esCursoEscolar(v), 'Curso de compra no válido (2022-23)')
  .nullable()
  .optional();
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const texto = (max: number) => z.string().trim().max(max).nullable().optional();
const id = z.string().uuid();

/** El estado de un alumno. `modalidad: null` = volver a «sin informar». */
export const estadoAlumnoSchema = z.object({
  eduStudentId: id,
  modalidad: z.enum(MODALIDADES).nullable(),
  cursoCompra: cursoCompraSchema,
  aCasa: z.boolean().nullable().optional(),
  firmadoAt: fechaISO.nullable().optional(),
  hermanoId: id.nullable().optional(),
  modeloId: id.nullable().optional(),
  numeroSerie: texto(60),
  notas: texto(500),
  /** Prestado: qué iPad del cole se le da (null = ninguno todavía). */
  aparatoId: id.nullable().optional(),
});
export type EstadoAlumnoInput = z.infer<typeof estadoAlumnoSchema>;

/** «A todos estos»: una modalidad (y su curso de compra) a varios alumnos de una vez. */
export const masivoSchema = z.object({
  eduStudentIds: z.array(id).min(1).max(400),
  modalidad: z.enum(MODALIDADES),
  cursoCompra: cursoCompraSchema,
  aCasa: z.boolean().nullable().optional(),
});

/** Alta de iPads del cole: en serie (`cantidad`) o pegando números de serie (`series`). */
export const altaAparatosSchema = z
  .object({
    uso: z.enum(USOS),
    modeloId: id.nullable().optional(),
    cantidad: z.number().int().min(1).max(200).optional(),
    series: z.array(z.string().trim().min(1).max(60)).max(400).optional(),
    notas: texto(500),
  })
  .refine((v) => Boolean(v.cantidad) !== Boolean(v.series?.length), 'Di cuántos, o pega los números de serie');

/** Cambiar un iPad del cole. `titular`: a quién se le da (o `null` para devolverlo). */
export const editarAparatoSchema = z.object({
  codigo: z.string().trim().min(1).max(20).optional(),
  modeloId: id.nullable().optional(),
  numeroSerie: texto(60),
  estado: z.enum(ESTADOS_APARATO).optional(),
  notas: texto(500),
  titular: z
    .union([
      z.object({ tipo: z.literal('alumno'), id }),
      z.object({ tipo: z.literal('profe'), id }),
      z.null(),
    ])
    .optional(),
});

export const modeloSchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  nombre: z.string().trim().min(2, 'Ponle nombre al modelo').max(80),
  capacidadGb: z.number().int().min(1).max(4096).nullable().optional(),
  notas: texto(300),
  activo: z.boolean().optional(),
});
