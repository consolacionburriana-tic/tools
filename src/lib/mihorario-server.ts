// Capa de servidor de "Mi horario": quién eres, tus preferencias, los festivos del centro y
// la bitácora de qué se exportó. Ficha: docs/20-mi-horario.md
import { and, desc, eq, gte, lte, or } from 'drizzle-orm';

import { db } from '@/db';
import {
  eduTeachers,
  horFestivos,
  horPeriodos,
  mihExportaciones,
  mihPreferencias,
  type EduTeacher,
  type HorFestivo,
  type MihPreferencias,
} from '@/db/schema';
import { PLANTILLA_TITULO_DEFECTO } from '@/lib/mihorario';

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
    calendarioGoogleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface EntradaPreferencias {
  plantillaTitulo: string;
  plantillaDescripcion?: string | null;
  emojis: Record<string, string>;
  calendarioGoogleId?: string | null;
}

export async function guardarPreferencias(eduTeacherId: string, entrada: EntradaPreferencias): Promise<void> {
  const existe = await db.select({ id: mihPreferencias.id }).from(mihPreferencias).where(eq(mihPreferencias.eduTeacherId, eduTeacherId)).limit(1);
  const valores = {
    plantillaTitulo: entrada.plantillaTitulo,
    plantillaDescripcion: entrada.plantillaDescripcion ?? null,
    emojis: entrada.emojis,
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
