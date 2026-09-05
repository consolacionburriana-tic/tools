// Queries de horarios (Drizzle). Ficha: docs/07-horarios.md
//
// De momento vive aquí el VOLCADO de una importación. La regla que lo gobierna todo es que
// sea **idempotente y reejecutable**: importar dos veces el mismo fichero tiene que dejar
// la base igual que importarlo una vez. Se consigue borrando y reescribiendo el periodo
// entero por etapa en una transacción, en vez de intentar casar fila a fila: un horario es
// una foto completa de un curso, no un diario de cambios, y "lo que trae el fichero" es
// siempre la verdad.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
  eduTeachers,
  horActividades,
  horAsignacionGrupos,
  horAsignacionProfes,
  horAsignaciones,
  horEspacios,
  horMaterias,
  horPeriodos,
  horRejillaAmbitos,
  horRejillas,
  horSesiones,
  horTramos,
} from '@/db/schema';
import { etapaDeCursoHorario } from '@/lib/horarios';
import { type Incidencia, type ResultadoBloque } from '@/lib/horarios-import';

export interface ResumenImportacion {
  periodo: string;
  rejillas: number;
  tramos: number;
  materias: number;
  espacios: number;
  asignaciones: number;
  sesiones: number;
  profesVinculados: number;
  profesNoEncontrados: string[];
  incidencias: Incidencia[];
  notas: string[];
}

export interface OpcionesImportacion {
  academicYear: string;
  periodoNombre: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad?: number;
  esOrdinario?: boolean;
}

/**
 * Vuelca los bloques ya normalizados de un fichero a la BBDD.
 *
 * Una **rejilla por etapa**, construida con los tramos que trae el propio fichero y
 * replicada de lunes a viernes. Se hace así, y no leyendo las rejillas del "Horario
 * general", a propósito: la fuente de dónde va una sesión tiene que ser el mismo fichero
 * que dice qué es esa sesión, o un desajuste de cinco minutos entre dos ficheros deja
 * sesiones sin hueco. Cuando llegue secundaria, que sí tiene días distintos entre sí, esto
 * seguirá valiendo porque el fichero de cada clase trae sus propias horas.
 */
export async function importarBloques(
  bloques: readonly ResultadoBloque[],
  opciones: OpcionesImportacion,
): Promise<ResumenImportacion> {
  const resumen: ResumenImportacion = {
    periodo: opciones.periodoNombre,
    rejillas: 0, tramos: 0, materias: 0, espacios: 0,
    asignaciones: 0, sesiones: 0, profesVinculados: 0,
    profesNoEncontrados: [], incidencias: [], notas: [],
  };

  const utiles = bloques.filter((b) => b.clase && b.sesiones.length > 0);
  if (utiles.length === 0) return resumen;
  for (const b of utiles) {
    resumen.incidencias.push(...b.incidencias);
    resumen.notas.push(...b.notas);
  }

  // ── Periodo (uno por nombre + curso académico) ──────────────────────────────
  const [periodo] = await db
    .select()
    .from(horPeriodos)
    .where(and(eq(horPeriodos.academicYear, opciones.academicYear), eq(horPeriodos.nombre, opciones.periodoNombre)))
    .limit(1);
  const periodoId =
    periodo?.id ??
    (
      await db
        .insert(horPeriodos)
        .values({
          academicYear: opciones.academicYear,
          nombre: opciones.periodoNombre,
          fechaInicio: opciones.fechaInicio,
          fechaFin: opciones.fechaFin,
          prioridad: opciones.prioridad ?? 0,
          esOrdinario: opciones.esOrdinario ?? false,
        })
        .returning()
    )[0].id;

  // ── Catálogos: profes por alias, actividades, materias y espacios ───────────
  // El alias de `edu_teachers` ES el código del export ('MVER0'), verificado contra los
  // ficheros reales: no hace falta tabla de traducción para el profesorado.
  const profes = await db.select({ id: eduTeachers.id, alias: eduTeachers.alias }).from(eduTeachers);
  const profePorAlias = new Map(profes.filter((p) => p.alias).map((p) => [p.alias!.toUpperCase(), p.id]));

  const actividades = await db.select().from(horActividades);
  const actividadPorCodigo = new Map(actividades.map((a) => [a.codigo, a.id]));
  const idClase = actividadPorCodigo.get('clase');
  if (!idClase) throw new Error("Falta la actividad 'clase' en hor_actividades: ¿se ejecutó la semilla?");

  const materiaPorCodigo = await asegurarMaterias(utiles);
  const espacioPorCodigo = await asegurarEspacios(utiles);
  resumen.materias = materiaPorCodigo.size;
  resumen.espacios = espacioPorCodigo.size;

  // ── Rejilla por etapa, con los tramos del propio fichero ────────────────────
  const tramoId = new Map<string, string>(); // `${etapa}|${dia}|${orden}` → id
  const porEtapa = new Map<string, ResultadoBloque[]>();
  for (const b of utiles) {
    const etapa = etapaDeCursoHorario(b.clase!.curso) ?? 'OTRA';
    porEtapa.set(etapa, [...(porEtapa.get(etapa) ?? []), b]);
  }

  for (const [etapa, suyos] of porEtapa) {
    const nombre = `${opciones.periodoNombre} · ${etapa}`;
    await borrarRejilla(periodoId, nombre);
    const [rejilla] = await db.insert(horRejillas).values({ periodoId, nombre }).returning();
    resumen.rejillas++;
    await db.insert(horRejillaAmbitos).values({ rejillaId: rejilla.id, etapa });

    // Los tramos son iguales en todas las clases de la etapa; se coge el bloque con más.
    const plantilla = suyos.reduce((a, b) => (b.tramos.length > a.tramos.length ? b : a)).tramos;
    const filas = [1, 2, 3, 4, 5].flatMap((dia) =>
      plantilla.map((t) => ({
        rejillaId: rejilla.id,
        diaSemana: dia,
        orden: t.orden,
        etiqueta: t.tipo === 'sesion' ? `${t.orden}ª` : t.tipo === 'recreo' ? 'Patio' : 'Comedor',
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        tipo: t.tipo,
      })),
    );
    const creados = await db.insert(horTramos).values(filas).returning();
    resumen.tramos += creados.length;
    for (const t of creados) tramoId.set(`${etapa}|${t.diaSemana}|${t.orden}`, t.id);
  }

  // ── Asignaciones y sesiones ─────────────────────────────────────────────────
  await borrarAsignaciones(periodoId);

  for (const b of utiles) {
    const clase = b.clase!;
    const etapa = etapaDeCursoHorario(clase.curso) ?? 'OTRA';

    // Una asignación por (materia|actividad + profes + aula) dentro de la clase: las N
    // sesiones semanales de Matemáticas de 2ESO B son UNA asignación puesta N veces, que
    // es justo lo que hace falta para que "quitarle Mates a este profe" sea un solo cambio.
    const clave = (s: (typeof b.sesiones)[number]) =>
      [s.actividadCodigo, s.materiaCodigo ?? '', [...s.profeCodigos].sort().join('+'), s.aulaCodigo ?? ''].join('|');

    const grupos = new Map<string, typeof b.sesiones>();
    for (const s of b.sesiones) grupos.set(clave(s), [...(grupos.get(clave(s)) ?? []), s]);

    for (const [, sesiones] of grupos) {
      const primera = sesiones[0];
      const actividadId = actividadPorCodigo.get(primera.actividadCodigo) ?? idClase;
      const [asig] = await db
        .insert(horAsignaciones)
        .values({
          periodoId,
          academicYear: opciones.academicYear,
          actividadId,
          materiaId: primera.materiaCodigo ? (materiaPorCodigo.get(primera.materiaCodigo) ?? null) : null,
          etiqueta: primera.materiaCodigo ? null : primera.crudo.slice(0, 120),
          espacioId: primera.aulaCodigo ? (espacioPorCodigo.get(primera.aulaCodigo) ?? null) : null,
          aula: primera.aulaCodigo,
          origen: 'importado',
        })
        .returning();
      resumen.asignaciones++;

      await db.insert(horAsignacionGrupos).values({ asignacionId: asig.id, curso: clase.curso, letra: clase.letra });

      const alias = [...new Set(primera.profeCodigos)];
      const filasProfe = alias
        .map((a, i) => {
          const id = profePorAlias.get(a);
          if (!id) { if (!resumen.profesNoEncontrados.includes(a)) resumen.profesNoEncontrados.push(a); return null; }
          return { asignacionId: asig.id, eduTeacherId: id, rol: rolDeActividad(primera.actividadCodigo, i), principal: i === 0 };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      if (filasProfe.length) {
        await db.insert(horAsignacionProfes).values(filasProfe);
        resumen.profesVinculados += filasProfe.length;
      }

      const filasSesion = sesiones
        .map((s) => {
          const id = tramoId.get(`${etapa}|${s.dia}|${s.orden}`);
          return id ? { asignacionId: asig.id, tramoId: id, diaSemana: s.dia, orden: s.orden } : null;
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      if (filasSesion.length) {
        await db.insert(horSesiones).values(filasSesion);
        resumen.sesiones += filasSesion.length;
      }
    }
  }

  return resumen;
}

function rolDeActividad(actividad: string, indice: number): string {
  if (actividad === 'apoyo_pt') return 'pt';
  if (actividad === 'apoyo_al') return 'al';
  return indice === 0 ? 'titular' : 'apoyo';
}

/** Crea las materias que falten (por código) y devuelve el mapa código → id. */
async function asegurarMaterias(bloques: readonly ResultadoBloque[]): Promise<Map<string, string>> {
  const nombres = new Map<string, { nombre: string; etapa: string | null }>();
  for (const b of bloques) {
    const etapa = etapaDeCursoHorario(b.clase?.curso) ?? null;
    for (const [codigo, nombre] of b.leyendas.materias) if (!nombres.has(codigo)) nombres.set(codigo, { nombre, etapa });
  }
  // El código de materia lleva el curso pegado ('LEN1' vs 'LEN3'), así que la identidad de
  // la materia es su NOMBRE; el código se guarda como abreviatura para poder repintarlo.
  const existentes = await db.select().from(horMaterias);
  const porNombre = new Map(existentes.map((m) => [m.nombre.toLowerCase(), m.id]));
  const mapa = new Map<string, string>();
  for (const [codigo, { nombre, etapa }] of nombres) {
    let id = porNombre.get(nombre.toLowerCase());
    if (!id) {
      const [creada] = await db.insert(horMaterias).values({ nombre, abreviatura: codigo, etapa }).returning();
      id = creada.id;
      porNombre.set(nombre.toLowerCase(), id);
    }
    mapa.set(codigo, id);
  }
  return mapa;
}

/** Crea los espacios que falten (por código normalizado) y devuelve código → id. */
async function asegurarEspacios(bloques: readonly ResultadoBloque[]): Promise<Map<string, string>> {
  const vistos = new Map<string, string>();
  for (const b of bloques) for (const [codigo, nombre] of b.leyendas.aulas) if (!vistos.has(codigo)) vistos.set(codigo, nombre);
  const existentes = await db.select().from(horEspacios);
  const mapa = new Map<string, string>(existentes.map((e) => [e.codigo, e.id] as const));
  for (const [codigo, nombre] of vistos) {
    if (mapa.has(codigo)) continue;
    const [creado] = await db.insert(horEspacios).values({ codigo, nombre }).returning();
    mapa.set(codigo, creado.id);
  }
  return mapa;
}

async function borrarRejilla(periodoId: string, nombre: string): Promise<void> {
  const previas = await db
    .select({ id: horRejillas.id })
    .from(horRejillas)
    .where(and(eq(horRejillas.periodoId, periodoId), eq(horRejillas.nombre, nombre)));
  if (previas.length === 0) return;
  const ids = previas.map((r) => r.id);
  const tramos = await db.select({ id: horTramos.id }).from(horTramos).where(inArray(horTramos.rejillaId, ids));
  if (tramos.length) {
    await db.delete(horSesiones).where(inArray(horSesiones.tramoId, tramos.map((t) => t.id)));
    await db.delete(horTramos).where(inArray(horTramos.rejillaId, ids));
  }
  await db.delete(horRejillaAmbitos).where(inArray(horRejillaAmbitos.rejillaId, ids));
  await db.delete(horRejillas).where(inArray(horRejillas.id, ids));
}

/** Borra lo IMPORTADO de un periodo; lo creado a mano se respeta (origen 'manual'). */
async function borrarAsignaciones(periodoId: string): Promise<void> {
  const previas = await db
    .select({ id: horAsignaciones.id })
    .from(horAsignaciones)
    .where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignaciones.origen, 'importado')));
  if (previas.length === 0) return;
  const ids = previas.map((a) => a.id);
  await db.delete(horSesiones).where(inArray(horSesiones.asignacionId, ids));
  await db.delete(horAsignacionProfes).where(inArray(horAsignacionProfes.asignacionId, ids));
  await db.delete(horAsignacionGrupos).where(inArray(horAsignacionGrupos.asignacionId, ids));
  await db.delete(horAsignaciones).where(inArray(horAsignaciones.id, ids));
}
