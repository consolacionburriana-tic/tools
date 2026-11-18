// Dispositivos 1:1: helpers puros (sin IO). Ficha: docs/29-dispositivos.md.
//
// Lo que se decide sin tocar la BBDD: los estados de un alumno (comprado, de casa, prestado,
// de hermano), el seguro de 4 cursos y lo que paga cada uno, los códigos de los iPads del cole
// (S1, P1…) y los schemas de lo que entra por la red.
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

// ─── Categorías de iPads del cole ─────────────────────────────────────────────
//
// Antes eran dos lotes fijos. Desde el 18-nov-2026 son filas de `dis_categorias` y el colegio
// añade las suyas (TEC de la escuela de idiomas, AL de audición y lenguaje…). Dos siguen siendo
// especiales porque el resto del módulo cuelga de ellas, y por eso no se pueden quitar:
//  - `sustitucion` («S»): los del alumnado. El mismo S3 se presta para todo el curso a un alumno
//    «Prestado» o se deja mientras arreglan el suyo (David, 20-oct-2026).
//  - `profesorado` («P»): los del claustro, desde 5º EP; su pantalla dice a qué profes les toca.
// Su `clave` es el `uso` que ya llevaban los iPads, así que no hubo que migrar ninguno.
export const USO_SUSTITUCION = 'sustitucion';
export const USO_PROFESORADO = 'profesorado';
/** Las que el código necesita para funcionar: se pueden renombrar, no quitar ni cambiar de titular. */
export const USOS_FIJOS: readonly string[] = [USO_SUSTITUCION, USO_PROFESORADO];

/** La clave de una categoría: `sustitucion`, `profesorado`, `tec`, `audicion-lenguaje`… */
export type Uso = string;

/** A quién se le da un iPad de la categoría. `nadie`: es del centro, sin titular (un carro, un aula). */
export const TITULARES = ['alumno', 'profe', 'nadie'] as const;
export type TitularTipo = (typeof TITULARES)[number];
export const TITULAR_LABEL: Record<TitularTipo, string> = {
  alumno: 'Alumnado',
  profe: 'Profesorado',
  nadie: 'Nadie (del centro)',
};
export const TITULAR_EXPLICA: Record<TitularTipo, string> = {
  alumno: 'Se le da a un alumno',
  profe: 'Se le da a un profe',
  nadie: 'Se queda en el centro, sin dárselo a nadie',
};

export function esTitularTipo(valor: unknown): valor is TitularTipo {
  return typeof valor === 'string' && (TITULARES as readonly string[]).includes(valor);
}

/** Una categoría tal como viaja a la pantalla. */
export interface CategoriaDis {
  clave: Uso;
  nombre: string;
  /** Las letras de sus códigos: «S» → S1, S2… */
  prefijo: string;
  titular: TitularTipo;
  explica: string | null;
  orden: number;
  /** false = archivada: ya no sale como pestaña. */
  activo: boolean;
}

/** Los códigos son letras y luego el número: `TEC12`. Sin cifras en el prefijo, para que `TEC1` y `TEC12` no se mezclen. */
export const PREFIJO_RE = /^[A-Z]{1,4}$/;

/** «Escola d'idiomes» → «EI»; «Audición y lenguaje» → «AL» (las palabras de una letra no cuentan); una sola palabra, sus tres primeras letras. */
export function sugerirPrefijo(nombre: string): string {
  const palabras = quitarTildes(nombre)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1);
  if (palabras.length === 0) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 3);
  return palabras
    .map((p) => p[0])
    .join('')
    .slice(0, 4);
}

/** «Escola d'idiomes (TEC)» → «escola-d-idiomes-tec». La clave de una categoría nueva. */
export function claveDeNombre(nombre: string): string {
  return quitarTildes(nombre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function quitarTildes(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Cómo se quiere el nombre de una categoría dentro de una frase: «Alta (sustitución)». */
export function nombreEnFrase(c: Pick<CategoriaDis, 'nombre'>): string {
  return c.nombre.trim().toLowerCase();
}

/** Las categorías que salen como pestaña, en su orden. */
export function categoriasVisibles(categorias: readonly CategoriaDis[]): CategoriaDis[] {
  return categorias.filter((c) => c.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

/** El estado físico del aparato. Quién lo tiene va aparte (`titular`). */
export const ESTADOS_APARATO = ['activo', 'reparacion', 'baja'] as const;
export type EstadoAparato = (typeof ESTADOS_APARATO)[number];
export const ESTADO_APARATO_LABEL: Record<EstadoAparato, string> = {
  activo: 'Operativo',
  reparacion: 'En reparación',
  baja: 'De baja',
};

/** El estado de un cargador: puede perderse o romperse sin que el iPad deje de funcionar. */
export const ESTADOS_CARGADOR = ['activo', 'perdido', 'baja'] as const;
export type EstadoCargador = (typeof ESTADOS_CARGADOR)[number];
export const ESTADO_CARGADOR_LABEL: Record<EstadoCargador, string> = {
  activo: 'Operativo',
  perdido: 'Perdido',
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

/** «Comprado · 2022-23 · seguro vencido», «Prestado S12 · a casa», «De casa». */
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

/** El número de un código con ese prefijo («S12» con «S» → 12), o null si es de otra categoría. */
export function numeroDeCodigo(prefijo: string, codigo: string): number | null {
  const m = codigo.trim().toUpperCase().match(new RegExp(`^${prefijo.toUpperCase()}(\\d+)$`));
  return m ? Number(m[1]) : null;
}

/** Los `n` códigos libres siguientes de un prefijo: tras el más alto que haya («S7» → S8, S9…). */
export function siguientesCodigos(prefijo: string, existentes: readonly string[], n = 1): string[] {
  const p = prefijo.toUpperCase();
  const max = existentes.reduce((acc, c) => Math.max(acc, numeroDeCodigo(p, c) ?? 0), 0);
  return Array.from({ length: n }, (_, i) => `${p}${max + i + 1}`);
}

/** Orden natural de códigos: S2 antes que S10, y por letra primero. */
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
    /** La clave de la categoría (se comprueba contra `dis_categorias` en el servidor). */
    uso: z.string().trim().min(1).max(40),
    modeloId: id.nullable().optional(),
    cantidad: z.number().int().min(1).max(200).optional(),
    series: z.array(z.string().trim().min(1).max(60)).max(400).optional(),
    notas: texto(500),
    /** Cada iPad nace con su cargador (con el mismo código). */
    conCargador: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.cantidad) !== Boolean(v.series?.length), 'Di cuántos, o pega los números de serie');

/** Cambiar un iPad del cole. `titular`: a quién se le da (o `null` para devolverlo). */
export const editarAparatoSchema = z.object({
  codigo: z.string().trim().min(1).max(20).optional(),
  modeloId: id.nullable().optional(),
  numeroSerie: texto(60),
  estado: z.enum(ESTADOS_APARATO).optional(),
  notas: texto(500),
  /** El cargador del iPad: datos o estado (lo crea si no tenía), o `null` para quitarlo. */
  cargador: z
    .object({
      codigo: z.string().trim().min(1).max(20).optional(),
      estado: z.enum(ESTADOS_CARGADOR).optional(),
      notas: texto(300),
    })
    .nullable()
    .optional(),
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

/** Crear o cambiar una categoría de iPads del cole. */
export const categoriaSchema = z.object({
  nombre: z.string().trim().min(2, 'Ponle nombre a la categoría').max(60),
  prefijo: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => PREFIJO_RE.test(v), 'El prefijo son de 1 a 4 letras (TEC, AL…), sin números'),
  titular: z.enum(TITULARES),
  explica: texto(200),
});
export type CategoriaInput = z.infer<typeof categoriaSchema>;
