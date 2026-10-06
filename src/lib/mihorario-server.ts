// Capa de servidor de "Mi horario": quién eres, tus preferencias, los festivos del centro y
// la bitácora de qué se exportó. Ficha: docs/20-mi-horario.md
import { and, desc, eq, gte, lte, or } from 'drizzle-orm';

import { db } from '@/db';
import {
  eduTeachers,
  horActividades,
  horAsignacionProfes,
  horAsignaciones,
  horFestivos,
  horPeriodos,
  horRejillas,
  horSesiones,
  horTramos,
  mihExportaciones,
  mihPreferencias,
  type EduTeacher,
  type HorFestivo,
  type MihPreferencias,
} from '@/db/schema';
import { PLANTILLA_TITULO_DEFECTO } from '@/lib/mihorario';
import type { CrearAnotacion, EditarAnotacion } from '@/lib/mihorario-anotaciones';

/** El profe que hay detrás de un login, por correo. `null` = no está en `edu_teachers`. */
export async function getProfePorEmail(email: string): Promise<EduTeacher | null> {
  const [profe] = await db
    .select()
    .from(eduTeachers)
    .where(and(eq(eduTeachers.email, email), eq(eduTeachers.active, true)))
    .limit(1);
  return profe ?? null;
}

/** Preferencias de una persona, o las de defecto si aún no ha tocado nada. */
export async function getPreferencias(eduTeacherId: string): Promise<MihPreferencias> {
  const [fila] = await db.select().from(mihPreferencias).where(eq(mihPreferencias.eduTeacherId, eduTeacherId)).limit(1);
  if (fila) return fila;
  return {
    id: '',
    eduTeacherId,
    plantillaTitulo: PLANTILLA_TITULO_DEFECTO,
    plantillaDescripcion: null,
    emojis: {},
    abreviaturas: {},
    colores: {},
    rangoCurso: 'sep-jun',
    calendarioGoogleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface EntradaPreferencias {
  plantillaTitulo: string;
  plantillaDescripcion?: string | null;
  emojis: Record<string, string>;
  abreviaturas?: Record<string, string>;
  colores?: Record<string, string>;
  rangoCurso?: string;
  calendarioGoogleId?: string | null;
}

export async function guardarPreferencias(eduTeacherId: string, entrada: EntradaPreferencias): Promise<void> {
  const existe = await db.select({ id: mihPreferencias.id }).from(mihPreferencias).where(eq(mihPreferencias.eduTeacherId, eduTeacherId)).limit(1);
  const valores = {
    plantillaTitulo: entrada.plantillaTitulo,
    plantillaDescripcion: entrada.plantillaDescripcion ?? null,
    emojis: entrada.emojis,
    abreviaturas: entrada.abreviaturas ?? {},
    colores: entrada.colores ?? {},
    rangoCurso: entrada.rangoCurso === 'oct-may' ? 'oct-may' : 'sep-jun',
    calendarioGoogleId: entrada.calendarioGoogleId ?? null,
    updatedAt: new Date(),
  };
  if (existe.length) {
    await db.update(mihPreferencias).set(valores).where(eq(mihPreferencias.eduTeacherId, eduTeacherId));
  } else {
    await db.insert(mihPreferencias).values({ eduTeacherId, ...valores });
  }
}

/** Los festivos del centro que solapan con un rango de fechas (típicamente, un periodo). */
export async function getFestivos(academicYear: string): Promise<HorFestivo[]> {
  return db.select().from(horFestivos).where(eq(horFestivos.academicYear, academicYear)).orderBy(horFestivos.fechaInicio);
}

export interface EntradaFestivo {
  academicYear: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  tipo?: string;
  notas?: string | null;
}

/** Alta de un festivo. Es COMPARTIDO: el primero que lo mete lo deja puesto para todos. */
export async function crearFestivo(entrada: EntradaFestivo): Promise<HorFestivo> {
  const [fila] = await db
    .insert(horFestivos)
    .values({
      academicYear: entrada.academicYear,
      nombre: entrada.nombre,
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      tipo: entrada.tipo ?? 'festivo',
      notas: entrada.notas ?? null,
    })
    .returning();
  return fila;
}

export async function eliminarFestivo(id: string): Promise<void> {
  await db.delete(horFestivos).where(eq(horFestivos.id, id));
}

/** Registra una exportación (para poder mostrar "última vez: …" y para el deshacer). */
export async function registrarExportacion(datos: {
  eduTeacherId: string;
  periodoId: string;
  calendarioGoogleId: string;
  eventosCreados: number;
}): Promise<void> {
  await db.insert(mihExportaciones).values(datos);
}

/** La última exportación de esta persona para este periodo, si la hay. */
export async function getUltimaExportacion(eduTeacherId: string, periodoId: string) {
  const [fila] = await db
    .select()
    .from(mihExportaciones)
    .where(and(eq(mihExportaciones.eduTeacherId, eduTeacherId), eq(mihExportaciones.periodoId, periodoId)))
    .orderBy(desc(mihExportaciones.createdAt))
    .limit(1);
  return fila ?? null;
}

/**
 * Los periodos que solapan con las fechas de un festivo — típicamente uno, pero si algún
 * año hay huecos entre periodos, puede que ninguno. Sirve para saber a qué exportaciones
 * afecta un festivo nuevo (por ahora informativo; el recálculo real pasa por reexportar).
 */
export async function getPeriodosQueSolapan(fechaInicio: string, fechaFin: string) {
  return db
    .select()
    .from(horPeriodos)
    .where(and(eq(horPeriodos.active, true), or(and(lte(horPeriodos.fechaInicio, fechaFin), gte(horPeriodos.fechaFin, fechaInicio)))));
}

// ─── Anotaciones propias en el horario ────────────────────────────────────────

/** Por qué no se pudo hacer algo con una anotación: el endpoint lo traduce a un código HTTP. */
export class ErrorAnotacion extends Error {
  constructor(message: string, readonly estado: 400 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

/**
 * Pone algo a mano en un hueco del horario de `profeId`. Es una asignación `manual` sin
 * grupo, con una sesión en ese tramo. Tres inserciones en un solo `batch`: o están las tres o
 * ninguna (no hay transacciones interactivas sobre neon-http, pero el batch sí es atómico).
 */
export async function crearAnotacion(profeId: string, datos: CrearAnotacion): Promise<{ sesionId: string }> {
  const [tramo] = await db
    .select({
      id: horTramos.id, dia: horTramos.diaSemana, orden: horTramos.orden, tipo: horTramos.tipo,
      horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin,
      periodoId: horRejillas.periodoId, academicYear: horPeriodos.academicYear,
    })
    .from(horTramos)
    .innerJoin(horRejillas, eq(horRejillas.id, horTramos.rejillaId))
    .innerJoin(horPeriodos, eq(horPeriodos.id, horRejillas.periodoId))
    .where(eq(horTramos.id, datos.tramoId))
    .limit(1);
  if (!tramo || tramo.periodoId !== datos.periodoId) throw new ErrorAnotacion('Ese hueco no existe en este horario', 404);
  if ((tramo.tipo ?? 'sesion') !== 'sesion') throw new ErrorAnotacion('Solo se puede anotar en una franja lectiva, no en el recreo ni en el comedor');

  // Lo mismo que se ve en pantalla: si a esa hora (mismo día, mismas horas) ya tienes algo, ese
  // hueco no está libre. Se mira por hora y no por tramo porque dos rejillas pueden compartirla.
  const [ocupado] = await db
    .select({ id: horSesiones.id })
    .from(horSesiones)
    .innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId))
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
    .innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id))
    .where(
      and(
        eq(horAsignaciones.periodoId, datos.periodoId),
        eq(horAsignacionProfes.eduTeacherId, profeId),
        eq(horTramos.diaSemana, tramo.dia),
        eq(horTramos.horaInicio, tramo.horaInicio),
        eq(horTramos.horaFin, tramo.horaFin),
      ),
    )
    .limit(1);
  if (ocupado) throw new ErrorAnotacion('Ya tienes algo a esa hora', 409);

  const [actividad] = await db.select({ id: horActividades.id }).from(horActividades).where(eq(horActividades.codigo, datos.actividad)).limit(1);
  if (!actividad) throw new ErrorAnotacion('Esa actividad no existe en el catálogo: ¿se ejecutó la semilla de horarios?');

  const asignacionId = crypto.randomUUID();
  const sesionId = crypto.randomUUID();
  await db.batch([
    db.insert(horAsignaciones).values({
      id: asignacionId,
      periodoId: datos.periodoId,
      academicYear: tramo.academicYear,
      actividadId: actividad.id,
      etiqueta: datos.etiqueta,
      aula: datos.aula,
      notas: datos.notas,
      origen: 'manual',
    }),
    db.insert(horAsignacionProfes).values({ asignacionId, eduTeacherId: profeId, rol: 'titular', principal: true }),
    db.insert(horSesiones).values({ id: sesionId, asignacionId, tramoId: tramo.id, diaSemana: tramo.dia, orden: tramo.orden }),
  ]);
  return { sesionId };
}

/** La anotación de una sesión, solo si es MANUAL y de esta persona; si no, no se toca. */
async function anotacionPropia(profeId: string, sesionId: string): Promise<{ asignacionId: string }> {
  const [fila] = await db
    .select({ asignacionId: horSesiones.asignacionId, origen: horAsignaciones.origen })
    .from(horSesiones)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
    .innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id))
    .where(and(eq(horSesiones.id, sesionId), eq(horAsignacionProfes.eduTeacherId, profeId)))
    .limit(1);
  if (!fila) throw new ErrorAnotacion('Esa anotación no existe', 404);
  if (fila.origen !== 'manual') throw new ErrorAnotacion('Esto viene del horario importado y no se puede cambiar desde aquí', 403);
  return { asignacionId: fila.asignacionId };
}

export async function editarAnotacion(profeId: string, datos: EditarAnotacion): Promise<void> {
  const { asignacionId } = await anotacionPropia(profeId, datos.sesionId);
  const [actividad] = await db.select({ id: horActividades.id }).from(horActividades).where(eq(horActividades.codigo, datos.actividad)).limit(1);
  if (!actividad) throw new ErrorAnotacion('Esa actividad no existe en el catálogo');
  await db
    .update(horAsignaciones)
    .set({ actividadId: actividad.id, etiqueta: datos.etiqueta, aula: datos.aula, notas: datos.notas, updatedAt: new Date() })
    .where(eq(horAsignaciones.id, asignacionId));
}

/**
 * Quita una anotación propia. Es un borrado de verdad (no `active=false`): son datos de una
 * sola persona sin significado histórico, y los pone y quita ella misma.
 */
export async function borrarAnotacion(profeId: string, sesionId: string): Promise<void> {
  const { asignacionId } = await anotacionPropia(profeId, sesionId);
  await db.batch([
    db.delete(horSesiones).where(eq(horSesiones.asignacionId, asignacionId)),
    db.delete(horAsignacionProfes).where(eq(horAsignacionProfes.asignacionId, asignacionId)),
    db.delete(horAsignaciones).where(eq(horAsignaciones.id, asignacionId)),
  ]);
}
