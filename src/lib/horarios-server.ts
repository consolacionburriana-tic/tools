// Queries de horarios (Drizzle). Ficha: docs/07-horarios.md
//
// De momento vive aquí el VOLCADO de una importación. La regla que lo gobierna todo es que
// sea **idempotente y reejecutable**: importar dos veces el mismo fichero tiene que dejar
// la base igual que importarlo una vez. Se consigue borrando y reescribiendo el periodo
// entero por etapa en una transacción, en vez de intentar casar fila a fila: un horario es
// una foto completa de un curso, no un diario de cambios, y "lo que trae el fichero" es
// siempre la verdad.

import { and, eq, inArray, isNull } from 'drizzle-orm';

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
import { compararClases, nombreClase } from '@/lib/cursos';
import { etapaDeCursoHorario, periodoVigente, type CeldaHorario } from '@/lib/horarios';
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
          // La etiqueta guarda el texto de la celda siempre que NO haya materia que pintar,
          // incluido el caso de una materia que no estaba en la leyenda ('Otros', 'AUX'):
          // sin esto la celda caía en el nombre de la actividad y ponía 'Clase', perdiendo
          // lo único que decía el fichero.
          etiqueta:
            primera.materiaCodigo && materiaPorCodigo.has(primera.materiaCodigo)
              ? null
              : primera.crudo.slice(0, 120),
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

// ─── Consultas del navegador ──────────────────────────────────────────────────

export interface PeriodoListado {
  id: string;
  nombre: string;
  academicYear: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  esOrdinario: boolean;
}

export async function getPeriodos(): Promise<PeriodoListado[]> {
  const filas = await db.select().from(horPeriodos).where(eq(horPeriodos.active, true));
  return filas
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      academicYear: p.academicYear,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      prioridad: p.prioridad,
      esOrdinario: p.esOrdinario,
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.prioridad - b.prioridad);
}

/** El periodo que manda una fecha; si no hay ninguno, el ordinario más reciente. */
export async function getPeriodoVigente(iso = new Date().toISOString().slice(0, 10)): Promise<PeriodoListado | null> {
  const todos = await getPeriodos();
  const vigente = periodoVigente(todos, iso);
  return vigente ?? todos.find((p) => p.esOrdinario) ?? todos[0] ?? null;
}

export interface OpcionesNavegador {
  clases: { curso: string; letra: string | null; etiqueta: string; etapa: string | null }[];
  profes: { id: string; nombre: string; alias: string | null; etapa: string | null }[];
  espacios: { id: string; codigo: string; nombre: string }[];
}

/** Lo que se puede elegir en el navegador, sacado de lo que REALMENTE tiene horario. */
export async function getOpcionesNavegador(periodoId: string): Promise<OpcionesNavegador> {
  const filas = await db
    .select({
      curso: horAsignacionGrupos.curso,
      letra: horAsignacionGrupos.letra,
    })
    .from(horAsignacionGrupos)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionGrupos.asignacionId))
    .where(eq(horAsignaciones.periodoId, periodoId));

  const vistas = new Map<string, { curso: string; letra: string | null }>();
  for (const f of filas) vistas.set(`${f.curso}|${f.letra ?? ''}`, { curso: f.curso, letra: f.letra });
  const clases = [...vistas.values()]
    .sort(compararClases)
    .map((c) => ({ ...c, etiqueta: nombreClase(c.curso, c.letra), etapa: etapaDeCursoHorario(c.curso) }));

  const conProfes = await db
    .selectDistinct({
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      alias: eduTeachers.alias,
      etapa: eduTeachers.etapa,
    })
    .from(horAsignacionProfes)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionProfes.asignacionId))
    .innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
    .where(eq(horAsignaciones.periodoId, periodoId));

  const profes = conProfes
    .map((p) => ({
      id: p.id,
      nombre: [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' '),
      alias: p.alias,
      etapa: p.etapa,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const conEspacios = await db
    .selectDistinct({ id: horEspacios.id, codigo: horEspacios.codigo, nombre: horEspacios.nombre })
    .from(horEspacios)
    .innerJoin(horAsignaciones, eq(horAsignaciones.espacioId, horEspacios.id))
    .where(eq(horAsignaciones.periodoId, periodoId));

  return { clases, profes, espacios: conEspacios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
}

export type VistaHorario = 'clase' | 'profe' | 'aula';

/**
 * Todas las celdas de un horario, ya listas para `construirCuadricula()`.
 *
 * Se hace en UNA consulta ancha con los joins y se agrupa en memoria en vez de ir sesión a
 * sesión: son unos cientos de filas por periodo y así el navegador responde de un tirón
 * (Neon cobra por consulta, no por fila).
 */
export async function getCeldas(
  periodoId: string,
  vista: VistaHorario,
  clave: string,
): Promise<CeldaHorario[]> {
  // Las columnas van en una constante y cada vista arma su cadena completa: compartir un
  // builder "base" y encadenarle joins distintos rompe la inferencia de tipos de Drizzle.
  const columnas = {
    sesionId: horSesiones.id,
    dia: horSesiones.diaSemana,
    tramoId: horTramos.id,
    horaInicio: horTramos.horaInicio,
    horaFin: horTramos.horaFin,
    tipoTramo: horTramos.tipo,
    asignacionId: horAsignaciones.id,
    materia: horMaterias.nombre,
    etiqueta: horAsignaciones.etiqueta,
    notas: horAsignaciones.notas,
    actividad: horActividades.codigo,
    actividadNombre: horActividades.nombre,
    lectivaActividad: horActividades.lectiva,
    lectivaAsignacion: horAsignaciones.lectiva,
    espacio: horEspacios.nombre,
    aulaTexto: horAsignaciones.aula,
  };

  interface FilaAncha {
    sesionId: string; dia: number; tramoId: string; horaInicio: string; horaFin: string;
    tipoTramo: string | null; asignacionId: string; materia: string | null;
    etiqueta: string | null; notas: string | null; actividad: string; actividadNombre: string;
    lectivaActividad: boolean; lectivaAsignacion: boolean | null;
    espacio: string | null; aulaTexto: string | null;
  }

  const conJoins = () =>
    db
      .select(columnas)
      .from(horSesiones)
      .innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId))
      .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
      .innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId))
      .leftJoin(horMaterias, eq(horMaterias.id, horAsignaciones.materiaId))
      .leftJoin(horEspacios, eq(horEspacios.id, horAsignaciones.espacioId));

  let filas: FilaAncha[];
  if (vista === 'clase') {
    const [curso, letra] = clave.split('|');
    filas = await conJoins()
      .innerJoin(horAsignacionGrupos, eq(horAsignacionGrupos.asignacionId, horAsignaciones.id))
      .where(
        and(
          eq(horAsignaciones.periodoId, periodoId),
          eq(horAsignacionGrupos.curso, curso),
          letra ? eq(horAsignacionGrupos.letra, letra) : isNull(horAsignacionGrupos.letra),
        ),
      );
  } else if (vista === 'profe') {
    filas = await conJoins()
      .innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id))
      .where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignacionProfes.eduTeacherId, clave)));
  } else {
    filas = await conJoins().where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignaciones.espacioId, clave)));
  }

  if (filas.length === 0) return [];

  // Profes y grupos de cada asignación, en dos consultas más (no en el join ancho: un
  // producto cartesiano de profes × grupos duplicaría las sesiones).
  const asignacionIds = [...new Set(filas.map((f) => f.asignacionId))];
  const profesFilas = await db
    .select({
      asignacionId: horAsignacionProfes.asignacionId,
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      rol: horAsignacionProfes.rol,
      principal: horAsignacionProfes.principal,
    })
    .from(horAsignacionProfes)
    .innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
    .where(inArray(horAsignacionProfes.asignacionId, asignacionIds));
  const gruposFilas = await db
    .select({ asignacionId: horAsignacionGrupos.asignacionId, curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra, subgrupo: horAsignacionGrupos.subgrupo })
    .from(horAsignacionGrupos)
    .where(inArray(horAsignacionGrupos.asignacionId, asignacionIds));

  const profesPor = new Map<string, CeldaHorario['profes']>();
  for (const p of profesFilas) {
    const lista = profesPor.get(p.asignacionId) ?? [];
    lista.push({ id: p.id, nombre: [p.nombre, p.apellido1].filter(Boolean).join(' '), rol: p.rol, principal: p.principal });
    profesPor.set(p.asignacionId, lista);
  }
  for (const lista of profesPor.values()) lista.sort((a, b) => Number(b.principal) - Number(a.principal));

  const gruposPor = new Map<string, string[]>();
  for (const g of gruposFilas) {
    const lista = gruposPor.get(g.asignacionId) ?? [];
    lista.push(nombreClase(g.curso, g.letra) + (g.subgrupo ? ` · ${g.subgrupo}` : ''));
    gruposPor.set(g.asignacionId, lista);
  }

  return filas.map((f) => {
    const profes = profesPor.get(f.asignacionId) ?? [];
    const grupos = gruposPor.get(f.asignacionId) ?? [];
    // El subtítulo es lo que NO se está mirando: en el horario de una clase interesa quién
    // la da; en el de un profe, a quién se la da; en el de un aula, las dos cosas.
    const subtitulo =
      vista === 'clase'
        ? (profes[0]?.nombre ?? null)
        : vista === 'profe'
          ? (grupos.join(', ') || null)
          : [grupos.join(', '), profes[0]?.nombre].filter(Boolean).join(' · ') || null;
    return {
      sesionId: f.sesionId,
      dia: f.dia,
      tramoId: f.tramoId,
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      tipoTramo: (f.tipoTramo ?? 'sesion') as CeldaHorario['tipoTramo'],
      titulo: f.materia ?? f.etiqueta ?? f.actividadNombre,
      subtitulo,
      actividad: f.actividad,
      lectiva: f.lectivaAsignacion ?? f.lectivaActividad,
      espacio: f.espacio ?? f.aulaTexto,
      profes,
      grupos,
      notas: f.notas,
    };
  });
}

/** Los recreos y comedores de la rejilla de un grupo, para que el hueco se vea aunque esté vacío. */
export async function getTramosNoLectivos(periodoId: string, etapa: string | null): Promise<CeldaHorario[]> {
  if (!etapa) return [];
  const filas = await db
    .select({ id: horTramos.id, dia: horTramos.diaSemana, horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin, tipo: horTramos.tipo })
    .from(horTramos)
    .innerJoin(horRejillas, eq(horRejillas.id, horTramos.rejillaId))
    .innerJoin(horRejillaAmbitos, eq(horRejillaAmbitos.rejillaId, horRejillas.id))
    .where(and(eq(horRejillas.periodoId, periodoId), eq(horRejillaAmbitos.etapa, etapa)));
  return filas
    .filter((t) => t.tipo !== 'sesion')
    .map((t) => ({
      sesionId: `tramo-${t.id}-${t.dia}`,
      dia: t.dia,
      tramoId: t.id,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      tipoTramo: t.tipo as CeldaHorario['tipoTramo'],
      titulo: t.tipo === 'recreo' ? 'Patio' : 'Comedor',
      subtitulo: null,
      actividad: t.tipo,
      lectiva: false,
      espacio: null,
      profes: [],
      grupos: [],
      notas: null,
    }));
}
