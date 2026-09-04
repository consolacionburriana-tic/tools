// Helpers puros de horarios (sin IO, testeables). Ficha: docs/07-horarios.md
//
// Aquí vive lo delicado del modelo de tres capas: resolver qué periodo está vigente una
// fecha dada, qué rejilla le toca a un grupo, qué tramo contiene una hora, y detectar los
// choques que ninguna clave ajena puede detectar por sí sola.

import { z } from 'zod';

import { etapaDeCurso, type Etapa } from '@/lib/cursos';

/** Etapas del centro. Las tres primeras están en uso; el resto, previstas y desactivadas. */
export const ETAPAS_HORARIO = [
  { codigo: 'EI', nombre: 'Infantil', active: true },
  { codigo: 'EP', nombre: 'Primaria', active: true },
  { codigo: 'ESO', nombre: 'Secundaria', active: true },
  { codigo: 'BACH', nombre: 'Bachillerato', active: false },
  { codigo: 'CFGM', nombre: 'CFGM', active: false },
  { codigo: 'CFGS', nombre: 'CFGS', active: false },
] as const;

export type EtapaHorario = (typeof ETAPAS_HORARIO)[number]['codigo'];

/**
 * Etapa de un curso **para horarios**. Delega en `etapaDeCurso()` (la compartida) y añade
 * las etapas previstas y hoy desactivadas.
 *
 * Vive aquí y no en `cursos.ts` a propósito: ampliar el tipo `Etapa` compartido obligaría a
 * dar respuesta a BACH/CFGM/CFGS en `cursoSiguiente()` y `cursoEnBanco()`, que son reglas
 * de promoción y de banco de libros que nadie ha decidido todavía y que tocarían módulos en
 * producción. Cuando esas etapas existan de verdad, esto se sube a `cursos.ts` con sus
 * reglas; hasta entonces, el alcance se queda en horarios.
 */
export function etapaDeCursoHorario(curso: string | null | undefined): EtapaHorario | null {
  const base = etapaDeCurso(curso);
  if (base) return base;
  if (!curso) return null;
  const c = curso.toUpperCase();
  if (c.includes('CFGS')) return 'CFGS';
  if (c.includes('CFGM')) return 'CFGM';
  if (c.includes('BACH') || c.includes('BAC')) return 'BACH';
  return null;
}

export const TIPOS_TRAMO = ['sesion', 'recreo', 'comedor', 'entrada', 'salida', 'otro'] as const;
export type TipoTramo = (typeof TIPOS_TRAMO)[number];

export const ROLES_PROFE_SESION = ['titular', 'apoyo', 'pt', 'al', 'practicas'] as const;
export type RolProfeSesion = (typeof ROLES_PROFE_SESION)[number];

export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'] as const;

/** Nombre del día a partir de `dia_semana` (1 = lunes … 5 = viernes). */
export function nombreDia(diaSemana: number): string {
  return DIAS[diaSemana - 1] ?? '';
}

/**
 * `dia_semana` (1 = lunes … 5 = viernes) de una fecha 'YYYY-MM-DD', o `null` en fin de
 * semana. Se parsea a mano y NO con `new Date(iso)`: eso interpreta la cadena como UTC y
 * en España un lunes a las 00:00 se convierte en el domingo anterior.
 */
export function diaSemanaDeFecha(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getDay(); // 0 = domingo
  return dow >= 1 && dow <= 5 ? dow : null;
}

/** 'HH:mm' → minutos desde medianoche. `null` si no es una hora válida. */
export function aMinutos(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos desde medianoche → 'HH:mm'. */
export function aHora(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface PeriodoVigencia {
  id: string;
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string;
  prioridad: number;
  active?: boolean;
}

/**
 * Qué periodo manda una fecha concreta. Los periodos se SOLAPAN a propósito: el ordinario
 * puede cubrir el curso entero y los de junio/septiembre le recortan por encima con más
 * prioridad. Así "el horario de junio empieza el 29 de mayo este año" es cambiar una fecha,
 * no rehacer el calendario.
 *
 * A igual prioridad gana el más corto: si alguien crea dos periodos con la misma prioridad,
 * el que abarca menos días es casi siempre la excepción, y esa es la intención razonable.
 */
export function periodoVigente<T extends PeriodoVigencia>(periodos: readonly T[], iso: string): T | null {
  const candidatos = periodos.filter(
    (p) => p.active !== false && p.fechaInicio <= iso && iso <= p.fechaFin,
  );
  if (candidatos.length === 0) return null;
  return candidatos.reduce((mejor, p) => {
    if (p.prioridad !== mejor.prioridad) return p.prioridad > mejor.prioridad ? p : mejor;
    return duracionDias(p) < duracionDias(mejor) ? p : mejor;
  });
}

function duracionDias(p: PeriodoVigencia): number {
  const a = Date.parse(`${p.fechaInicio}T00:00:00Z`);
  const b = Date.parse(`${p.fechaFin}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? Number.MAX_SAFE_INTEGER : b - a;
}

export interface AmbitoRejilla {
  rejillaId: string;
  etapa?: string | null;
  curso?: string | null;
  letra?: string | null;
}

/**
 * Qué rejilla le toca a un grupo, con precedencia por especificidad:
 *
 *   curso + letra  (3 puntos)  →  '1PRI A' tiene rejilla propia
 *   curso          (2)         →  todo 4ESO sale antes los jueves
 *   etapa          (1)         →  lo normal: una rejilla por etapa
 *   centro         (0)         →  todo a null, el comodín
 *
 * Gana el más específico que encaje. Un ámbito que menciona un curso o una letra distintos
 * a los del grupo no encaja, aunque acierte la etapa.
 */
export function rejillaDeGrupo(
  ambitos: readonly AmbitoRejilla[],
  grupo: { curso: string | null | undefined; letra?: string | null },
): string | null {
  const etapa = etapaDeCursoHorario(grupo.curso);
  let mejor: { rejillaId: string; peso: number } | null = null;

  for (const a of ambitos) {
    let peso = 0;
    if (a.curso) {
      if (!grupo.curso || a.curso.toUpperCase() !== grupo.curso.toUpperCase()) continue;
      peso += 2;
    }
    if (a.letra) {
      if (!grupo.letra || a.letra.toUpperCase() !== grupo.letra.toUpperCase()) continue;
      peso += 1;
    }
    if (a.etapa) {
      if (a.etapa.toUpperCase() !== etapa) continue;
      peso += 1;
    }
    if (!mejor || peso > mejor.peso) mejor = { rejillaId: a.rejillaId, peso };
  }
  return mejor?.rejillaId ?? null;
}

export interface TramoBasico {
  id: string;
  diaSemana: number;
  orden: number;
  etiqueta?: string | null;
  horaInicio: string;
  horaFin: string;
  tipo?: string | null;
}

/**
 * Tramo de un día que contiene una hora. El intervalo es **[inicio, fin)**: a las 08:45
 * en punto ya estás en la 2ª, no en la 1ª — que es lo que dice el timbre.
 *
 * Se devuelve también el recreo si la hora cae en el patio: quien pregunta necesita saber
 * que a esa hora no hay clase, y devolver `null` no distingue "es el patio" de "esa hora no
 * existe en la rejilla".
 */
export function tramoEnHora<T extends TramoBasico>(
  tramos: readonly T[],
  diaSemana: number,
  hora: string,
): T | null {
  const min = aMinutos(hora);
  if (min === null) return null;
  return (
    tramos.find((t) => {
      if (t.diaSemana !== diaSemana) return false;
      const ini = aMinutos(t.horaInicio);
      const fin = aMinutos(t.horaFin);
      return ini !== null && fin !== null && min >= ini && min < fin;
    }) ?? null
  );
}

/**
 * Si la hora cae entre dos tramos (o antes del primero), el SIGUIENTE tramo del día. Es lo
 * que necesita Puntualidad: quien llega a las 08:03, cuando la 1ª empieza a las 08:00, llega
 * tarde a la 1ª; quien llega a las 11:22 en pleno patio, llega tarde a la clase de después.
 */
export function tramoSiguiente<T extends TramoBasico>(
  tramos: readonly T[],
  diaSemana: number,
  hora: string,
): T | null {
  const min = aMinutos(hora);
  if (min === null) return null;
  return (
    tramos
      .filter((t) => t.diaSemana === diaSemana && (aMinutos(t.horaInicio) ?? -1) >= min)
      .sort((a, b) => (aMinutos(a.horaInicio) ?? 0) - (aMinutos(b.horaInicio) ?? 0))[0] ?? null
  );
}

/** ¿Es lectiva esta asignación? El catálogo pone el defecto, la asignación lo pisa. */
export function esLectiva(
  asignacion: { lectiva?: boolean | null },
  actividad: { lectiva: boolean },
): boolean {
  return asignacion.lectiva ?? actividad.lectiva;
}

export interface SesionParaConflictos {
  id: string;
  tramoId: string;
  profeIds: readonly string[];
  grupos: readonly { curso: string; letra?: string | null; subgrupo?: string | null }[];
  aula?: string | null;
}

export type TipoConflicto = 'profe' | 'grupo' | 'aula';

export interface Conflicto {
  tipo: TipoConflicto;
  tramoId: string;
  clave: string; // el profe, el grupo o el aula que choca
  sesionIds: string[];
}

/**
 * Choques dentro de un mismo tramo. No hay constraint que valga para esto: dos sesiones del
 * mismo grupo en el mismo hueco son un DESDOBLE legítimo (y ahí `subgrupo` es lo que las
 * distingue), mientras que un profe en dos aulas a la vez es un error de verdad. La regla:
 *
 *   - profe en dos sesiones del mismo tramo  → conflicto siempre.
 *   - grupo en dos sesiones del mismo tramo  → conflicto SOLO si alguna no declara
 *     subgrupo, o si dos declaran el mismo. Con subgrupos distintos es un desdoble.
 *   - aula en dos sesiones del mismo tramo   → conflicto (dos clases en un aula).
 */
export function detectarConflictos(sesiones: readonly SesionParaConflictos[]): Conflicto[] {
  const conflictos: Conflicto[] = [];
  const porTramo = new Map<string, SesionParaConflictos[]>();
  for (const s of sesiones) {
    const lista = porTramo.get(s.tramoId);
    if (lista) lista.push(s);
    else porTramo.set(s.tramoId, [s]);
  }

  for (const [tramoId, grupo] of porTramo) {
    if (grupo.length < 2) continue;

    acumular(conflictos, 'profe', tramoId, grupo, (s) => s.profeIds.map((p) => p));
    acumular(conflictos, 'aula', tramoId, grupo, (s) => (s.aula ? [s.aula] : []));

    // Grupos: la clave incluye el subgrupo, así que dos desdobles distintos no chocan…
    const porClase = new Map<string, SesionParaConflictos[]>();
    for (const s of grupo) {
      for (const g of s.grupos) {
        const clase = `${g.curso}${g.letra ? ` ${g.letra}` : ''}`;
        const lista = porClase.get(clase);
        if (lista) lista.push(s);
        else porClase.set(clase, [s]);
      }
    }
    for (const [clase, sesiones2] of porClase) {
      if (sesiones2.length < 2) continue;
      // …pero si alguna no declara subgrupo, o dos comparten el mismo, sí choca.
      const subgrupos = sesiones2.map(
        (s) => s.grupos.find((g) => `${g.curso}${g.letra ? ` ${g.letra}` : ''}` === clase)?.subgrupo ?? null,
      );
      const hayAnonimo = subgrupos.some((sg) => !sg);
      const repetido = new Set(subgrupos.filter(Boolean)).size !== subgrupos.filter(Boolean).length;
      if (hayAnonimo || repetido) {
        conflictos.push({ tipo: 'grupo', tramoId, clave: clase, sesionIds: sesiones2.map((s) => s.id) });
      }
    }
  }
  return conflictos;
}

function acumular(
  destino: Conflicto[],
  tipo: TipoConflicto,
  tramoId: string,
  sesiones: readonly SesionParaConflictos[],
  clavesDe: (s: SesionParaConflictos) => readonly string[],
): void {
  const porClave = new Map<string, string[]>();
  for (const s of sesiones) {
    for (const clave of clavesDe(s)) {
      const lista = porClave.get(clave);
      if (lista) lista.push(s.id);
      else porClave.set(clave, [s.id]);
    }
  }
  for (const [clave, sesionIds] of porClave) {
    if (sesionIds.length > 1) destino.push({ tipo, tramoId, clave, sesionIds });
  }
}

/**
 * Los tramos de un día "regulares", generados desde una hora de inicio y una duración.
 * Es lo que rellena el editor de rejillas de un tirón (primaria: 8:00, 6×45'), para no
 * teclear treinta horas a mano. `recreoTras` mete el patio después de esa sesión.
 */
export function generarTramosDia(opciones: {
  horaInicio: string;
  duracion: number;
  sesiones: number;
  recreoTras?: number | null;
  duracionRecreo?: number;
}): { orden: number; etiqueta: string; horaInicio: string; horaFin: string; tipo: TipoTramo }[] {
  const inicio = aMinutos(opciones.horaInicio);
  if (inicio === null || opciones.sesiones < 1 || opciones.duracion < 1) return [];
  const salida: { orden: number; etiqueta: string; horaInicio: string; horaFin: string; tipo: TipoTramo }[] = [];
  let cursor = inicio;
  let orden = 0;
  for (let n = 1; n <= opciones.sesiones; n++) {
    orden++;
    salida.push({
      orden,
      etiqueta: `${n}ª`,
      horaInicio: aHora(cursor),
      horaFin: aHora(cursor + opciones.duracion),
      tipo: 'sesion',
    });
    cursor += opciones.duracion;
    if (opciones.recreoTras && n === opciones.recreoTras) {
      const dur = opciones.duracionRecreo ?? 30;
      orden++;
      salida.push({ orden, etiqueta: 'Patio', horaInicio: aHora(cursor), horaFin: aHora(cursor + dur), tipo: 'recreo' });
      cursor += dur;
    }
  }
  return salida;
}

// ─── Schemas Zod compartidos cliente/servidor ─────────────────────────────────

const horaSchema = z.string().regex(/^\d{1,2}:\d{2}$/, 'Hora en formato HH:mm');
const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato YYYY-MM-DD');

export const periodoSchema = z
  .object({
    academicYear: z.string().min(4),
    nombre: z.string().min(1, 'Ponle nombre').max(80),
    fechaInicio: fechaSchema,
    fechaFin: fechaSchema,
    prioridad: z.number().int().min(0).max(100).default(0),
    esOrdinario: z.boolean().default(false),
    notas: z.string().max(500).optional().nullable(),
  })
  .refine((p) => p.fechaInicio <= p.fechaFin, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  });

export const tramoSchema = z
  .object({
    diaSemana: z.number().int().min(1).max(5),
    orden: z.number().int().min(1).max(30),
    etiqueta: z.string().max(20).optional().nullable(),
    horaInicio: horaSchema,
    horaFin: horaSchema,
    tipo: z.enum(TIPOS_TRAMO).default('sesion'),
  })
  .refine((t) => (aMinutos(t.horaInicio) ?? 0) < (aMinutos(t.horaFin) ?? 0), {
    message: 'La sesión tiene que acabar después de empezar',
    path: ['horaFin'],
  });

export const rejillaSchema = z.object({
  periodoId: z.string().uuid(),
  nombre: z.string().min(1).max(80),
  notas: z.string().max(500).optional().nullable(),
  ambitos: z
    .array(
      z.object({
        etapa: z.string().max(10).optional().nullable(),
        curso: z.string().max(20).optional().nullable(),
        letra: z.string().max(10).optional().nullable(),
      }),
    )
    .default([]),
});

export const asignacionSchema = z.object({
  periodoId: z.string().uuid(),
  actividadId: z.string().uuid(),
  materiaId: z.string().uuid().optional().nullable(),
  etiqueta: z.string().max(120).optional().nullable(),
  lectiva: z.boolean().optional().nullable(),
  aula: z.string().max(40).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  grupos: z
    .array(
      z.object({
        curso: z.string().min(1).max(20),
        letra: z.string().max(10).optional().nullable(),
        subgrupo: z.string().max(40).optional().nullable(),
      }),
    )
    .default([]),
  profes: z
    .array(
      z.object({
        eduTeacherId: z.string().uuid(),
        rol: z.enum(ROLES_PROFE_SESION).default('titular'),
        principal: z.boolean().default(false),
      }),
    )
    .default([]),
  sesiones: z.array(z.object({ tramoId: z.string().uuid(), aula: z.string().max(40).optional().nullable() })).default([]),
});

export const apoyoSchema = z
  .object({
    asignacionId: z.string().uuid(),
    eduStudentId: z.string().uuid(),
    modalidad: z.enum(['dentro', 'fuera']).default('fuera'),
    saleDeAsignacionId: z.string().uuid().optional().nullable(),
    fechaInicio: fechaSchema.optional().nullable(),
    fechaFin: fechaSchema.optional().nullable(),
    notas: z.string().max(500).optional().nullable(),
  })
  .refine((a) => !a.fechaInicio || !a.fechaFin || a.fechaInicio <= a.fechaFin, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  });

export type EntradaPeriodo = z.infer<typeof periodoSchema>;
export type EntradaTramo = z.infer<typeof tramoSchema>;
export type EntradaRejilla = z.infer<typeof rejillaSchema>;
export type EntradaAsignacion = z.infer<typeof asignacionSchema>;
export type EntradaApoyo = z.infer<typeof apoyoSchema>;

// Reexport para que las pantallas de horarios no tengan que importar de dos sitios.
export type { Etapa };
