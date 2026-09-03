// Capa de servidor de Tutorías: gestión rápida de qué profe tutoriza qué clase.
// Muchos-a-muchos a propósito (una clase puede tener varios tutores, un profe puede
// tutorizar varias clases): sin restricción de cardinalidad, la pantalla es la que decide.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import {
  eduRepartoConfirmado,
  eduStudents,
  eduTeachers,
  eduTutorias,
  eduTutorPersonal,
  type EduTeacher,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { planPromocion, type Reparto, resumenPlan } from '@/lib/tutorias';

export interface ClaseConTutores {
  curso: string;
  letra: string | null;
  numAlumnos: number;
  tutores: { id: string; teacherId: string; nombre: string }[];
  /** Alumnos de la clase con tutor personal asignado (y que sigue siendo tutor de la clase). */
  conTutorPersonal: number;
  /** Cuándo se confirmó que el reparto de esta clase está revisado para este curso. */
  repartoConfirmadoAt: Date | null;
}

const nombreCompleto = (p: Pick<EduTeacher, 'nombre' | 'apellido1' | 'apellido2'>) =>
  [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ');

/** Todas las clases reales (con alumnado activo) y sus tutores del curso académico actual. */
export async function getClasesConTutores(): Promise<ClaseConTutores[]> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias, profes, personales, confirmados] = await Promise.all([
    db
      .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
    db.select().from(eduTeachers).where(eq(eduTeachers.active, true)),
    db
      .select({ eduStudentId: eduTutorPersonal.eduStudentId, eduTeacherId: eduTutorPersonal.eduTeacherId })
      .from(eduTutorPersonal)
      .where(eq(eduTutorPersonal.academicYear, academicYear)),
    db.select().from(eduRepartoConfirmado).where(eq(eduRepartoConfirmado.academicYear, academicYear)),
  ]);
  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const personalPorAlumno = new Map(personales.map((p) => [p.eduStudentId, p.eduTeacherId]));

  const clases = new Map<string, { curso: string; letra: string | null; numAlumnos: number; alumnos: string[] }>();
  for (const a of alumnado) {
    if (!a.curso) continue;
    const k = `${a.curso}|${a.letra ?? ''}`;
    const c = clases.get(k) ?? { curso: a.curso, letra: a.letra, numAlumnos: 0, alumnos: [] };
    c.numAlumnos++;
    c.alumnos.push(a.id);
    clases.set(k, c);
  }

  return [...clases.values()].sort(compararClases).map(({ alumnos, ...c }) => {
    const tutores = tutorias
      .filter((t) => t.curso === c.curso && (t.letra ?? '') === (c.letra ?? ''))
      .map((t) => {
        const p = profePorId.get(t.eduTeacherId);
        return { id: t.id, teacherId: t.eduTeacherId, nombre: p ? nombreCompleto(p) : '(profe dado de baja)' };
      });
    // Un tutor personal que ya no tutoriza la clase (cambio de tutorías, promoción…) no
    // cuenta como asignado: la pantalla lo enseña como hueco y hay que revisarlo.
    const deLaClase = new Set(tutores.map((t) => t.teacherId));
    const confirmado = confirmados.find((r) => r.curso === c.curso && r.letra === (c.letra ?? ''));
    return {
      ...c,
      tutores,
      conTutorPersonal: alumnos.filter((id) => {
        const t = personalPorAlumno.get(id);
        return t ? deLaClase.has(t) : false;
      }).length,
      repartoConfirmadoAt: confirmado?.confirmadoAt ?? null,
    };
  });
}

// ─── Reparto de alumnos entre los tutores de una clase ────────────────────────

export interface AlumnoReparto {
  id: string;
  /** "Apellido1 Apellido2, Nombre" — pantalla interna detrás del login. */
  nombre: string;
  /** teacherId de su tutor personal, o null si está sin asignar. */
  tutorPersonal: string | null;
}

export interface RepartoClase {
  curso: string;
  letra: string | null;
  tutores: { teacherId: string; nombre: string }[];
  alumnos: AlumnoReparto[];
  confirmadoAt: Date | null;
  confirmadoPor: string | null;
  /** Asignaciones que apuntaban a alguien que ya no tutoriza la clase (se ignoran). */
  descolgados: number;
}

const cmpEs = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' });

/** Alumnado de una clase en orden alfabético con su tutor personal, más el estado del reparto. */
export async function getRepartoClase(curso: string, letra: string | null): Promise<RepartoClase> {
  const academicYear = academicYearActual();
  const [alumnado, tutorias, profes, confirmado] = await Promise.all([
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
      })
      .from(eduStudents)
      .where(
        and(
          eq(eduStudents.active, true),
          eq(eduStudents.curso, curso),
          letra ? eq(eduStudents.letra, letra) : isNull(eduStudents.letra),
        ),
      ),
    db
      .select()
      .from(eduTutorias)
      .where(
        and(
          eq(eduTutorias.academicYear, academicYear),
          eq(eduTutorias.curso, curso),
          letra ? eq(eduTutorias.letra, letra) : isNull(eduTutorias.letra),
        ),
      ),
    db.select().from(eduTeachers).where(eq(eduTeachers.active, true)),
    db
      .select()
      .from(eduRepartoConfirmado)
      .where(
        and(
          eq(eduRepartoConfirmado.academicYear, academicYear),
          eq(eduRepartoConfirmado.curso, curso),
          eq(eduRepartoConfirmado.letra, letra ?? ''),
        ),
      )
      .limit(1),
  ]);

  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const tutores = tutorias.map((t) => ({
    teacherId: t.eduTeacherId,
    nombre: profePorId.has(t.eduTeacherId) ? nombreCompleto(profePorId.get(t.eduTeacherId)!) : '(profe dado de baja)',
  }));
  const deLaClase = new Set(tutores.map((t) => t.teacherId));

  const ids = alumnado.map((a) => a.id);
  const personales =
    ids.length === 0
      ? []
      : await db
          .select({ eduStudentId: eduTutorPersonal.eduStudentId, eduTeacherId: eduTutorPersonal.eduTeacherId })
          .from(eduTutorPersonal)
          .where(and(eq(eduTutorPersonal.academicYear, academicYear), inArray(eduTutorPersonal.eduStudentId, ids)));
  const personalPorAlumno = new Map(personales.map((p) => [p.eduStudentId, p.eduTeacherId]));

  const alumnos = alumnado
    .sort((a, b) => cmpEs(a.apellido1, b.apellido1) || cmpEs(a.apellido2, b.apellido2) || cmpEs(a.nombre, b.nombre))
    .map((a) => {
      const asignado = personalPorAlumno.get(a.id) ?? null;
      return {
        id: a.id,
        nombre: [a.apellido1, a.apellido2].filter(Boolean).join(' ') + (a.nombre ? `, ${a.nombre}` : ''),
        tutorPersonal: asignado && deLaClase.has(asignado) ? asignado : null,
      };
    });

  return {
    curso,
    letra,
    tutores,
    alumnos,
    confirmadoAt: confirmado[0]?.confirmadoAt ?? null,
    confirmadoPor: confirmado[0]?.confirmadoPor ?? null,
    descolgados: [...personalPorAlumno.values()].filter((t) => !deLaClase.has(t)).length,
  };
}

/**
 * Guarda el reparto completo de una clase (reemplaza lo que hubiera). Solo se aceptan
 * tutores que de verdad tutorizan esa clase y alumnos que de verdad están en ella: la
 * pantalla manda el mapa entero, así que aquí se valida todo contra la BBDD.
 * Devuelve cuántos alumnos quedan con tutor personal.
 */
export async function guardarReparto(curso: string, letra: string | null, reparto: Reparto): Promise<number> {
  const academicYear = academicYearActual();
  const { alumnos, tutores } = await getRepartoClase(curso, letra);
  const deLaClase = new Set(tutores.map((t) => t.teacherId));
  const deLaClaseAlumnos = new Set(alumnos.map((a) => a.id));

  const asignaciones = Object.entries(reparto)
    .filter(([alumnoId, teacherId]) => teacherId && deLaClaseAlumnos.has(alumnoId) && deLaClase.has(teacherId))
    .map(([alumnoId, teacherId]) => ({
      eduStudentId: alumnoId,
      eduTeacherId: teacherId as string,
      academicYear,
      updatedAt: new Date(),
    }));

  // Borrar + reinsertar en un único batch: el reparto de una clase es una unidad, y así
  // no queda a medias si algo falla (mismo patrón que la promoción de tutorías).
  const statements: BatchItem<'pg'>[] = [];
  if (deLaClaseAlumnos.size > 0) {
    statements.push(
      db
        .delete(eduTutorPersonal)
        .where(
          and(
            eq(eduTutorPersonal.academicYear, academicYear),
            inArray(eduTutorPersonal.eduStudentId, [...deLaClaseAlumnos]),
          ),
        ),
    );
  }
  if (asignaciones.length > 0) statements.push(db.insert(eduTutorPersonal).values(asignaciones));
  if (statements.length > 0) await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

  return asignaciones.length;
}

/** Marca (o desmarca) el reparto de una clase como revisado para el curso en vigor. */
export async function confirmarReparto(
  curso: string,
  letra: string | null,
  quienEmail: string | null,
  confirmado = true,
): Promise<Date | null> {
  const academicYear = academicYearActual();
  if (!confirmado) {
    await db
      .delete(eduRepartoConfirmado)
      .where(
        and(
          eq(eduRepartoConfirmado.academicYear, academicYear),
          eq(eduRepartoConfirmado.curso, curso),
          eq(eduRepartoConfirmado.letra, letra ?? ''),
        ),
      );
    return null;
  }
  const [row] = await db
    .insert(eduRepartoConfirmado)
    .values({ curso, letra: letra ?? '', academicYear, confirmadoAt: new Date(), confirmadoPor: quienEmail })
    .onConflictDoUpdate({
      target: [eduRepartoConfirmado.curso, eduRepartoConfirmado.letra, eduRepartoConfirmado.academicYear],
      set: { confirmadoAt: new Date(), confirmadoPor: quienEmail },
    })
    .returning({ confirmadoAt: eduRepartoConfirmado.confirmadoAt });
  return row.confirmadoAt;
}

/**
 * Cambiar quién tutoriza una clase deja el reparto de alumnos sin revisar: si entra o sale
 * un tutor, lo que estaba repartido ya no vale, así que se retira la confirmación y la
 * pantalla vuelve a avisar de que hay que mirarlo.
 */
async function invalidarConfirmacion(curso: string, letra: string | null): Promise<void> {
  await db
    .delete(eduRepartoConfirmado)
    .where(
      and(
        eq(eduRepartoConfirmado.academicYear, academicYearActual()),
        eq(eduRepartoConfirmado.curso, curso),
        eq(eduRepartoConfirmado.letra, letra ?? ''),
      ),
    );
}

/** Asigna un profe como tutor de una clase (no-op si ya lo era). Devuelve el id de la tutoría. */
export async function asignarTutor(curso: string, letra: string | null, teacherId: string): Promise<string> {
  const [row] = await db
    .insert(eduTutorias)
    .values({ curso, letra, eduTeacherId: teacherId, academicYear: academicYearActual() })
    .onConflictDoUpdate({
      target: [eduTutorias.curso, eduTutorias.letra, eduTutorias.eduTeacherId, eduTutorias.academicYear],
      set: { academicYear: academicYearActual() }, // no-op, solo para poder devolver el id existente
    })
    .returning({ id: eduTutorias.id });
  await invalidarConfirmacion(curso, letra);
  return row.id;
}

/** Quita a un profe de una tutoría. */
export async function quitarTutor(tutoriaId: string): Promise<void> {
  const [row] = await db
    .delete(eduTutorias)
    .where(eq(eduTutorias.id, tutoriaId))
    .returning({ curso: eduTutorias.curso, letra: eduTutorias.letra });
  if (row) await invalidarConfirmacion(row.curso, row.letra);
}

/**
 * Promociona todas las tutorías del curso académico en vigor (ver `cursoSiguiente()` para
 * las reglas). El plan se **recalcula aquí**, no se fía del que ve el cliente, igual que el
 * sync de Educamos. Se hace borrando las tutorías implicadas y reinsertando las que tienen
 * destino, en un único `db.batch` (transacción): así se esquiva que el índice único no
 * deduplique las filas con `letra IS NULL`.
 */
export async function promocionarTutores(): Promise<{ movidas: number; liberadas: number }> {
  const academicYear = academicYearActual();
  const cambios = planPromocion(await getClasesConTutores());
  if (cambios.length === 0) return { movidas: 0, liberadas: 0 };

  const nuevas = cambios
    .filter((c) => c.hasta)
    .map((c) => ({ curso: c.hasta!.curso, letra: c.hasta!.letra, eduTeacherId: c.teacherId, academicYear }));
  // Defensivo: dos tutorías distintas nunca deberían caer en la misma clase con el mismo
  // profe, pero si pasara, el índice único reventaría el batch entero.
  const vistas = new Set<string>();
  const sinDuplicados = nuevas.filter((n) => {
    const k = `${n.curso}|${n.letra ?? ''}|${n.eduTeacherId}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });

  const statements: BatchItem<'pg'>[] = [
    db.delete(eduTutorias).where(inArray(eduTutorias.id, cambios.map((c) => c.tutoriaId))),
  ];
  if (sinDuplicados.length > 0) statements.push(db.insert(eduTutorias).values(sinDuplicados));
  // Al mover las tutorías, ningún reparto de alumnos sigue valiendo: se retiran todas las
  // confirmaciones del curso para que la pantalla pida revisarlos clase por clase.
  statements.push(db.delete(eduRepartoConfirmado).where(eq(eduRepartoConfirmado.academicYear, academicYear)));
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

  return resumenPlan(cambios);
}

/**
 * Borra las tutorías del curso académico en vigor, todas o solo las de una etapa.
 * No toca el histórico de otros años. Ojo: el formulario del ABC usa las tutorías para
 * sugerir destinatarios, así que dejarlo vacío tiene efecto fuera de esta pantalla.
 */
export async function limpiarTutorias(etapa?: Etapa): Promise<number> {
  const academicYear = academicYearActual();
  if (!etapa) {
    const borradas = await db
      .delete(eduTutorias)
      .where(eq(eduTutorias.academicYear, academicYear))
      .returning({ id: eduTutorias.id });
    await db.delete(eduRepartoConfirmado).where(eq(eduRepartoConfirmado.academicYear, academicYear));
    return borradas.length;
  }
  // `etapa` no es una columna: se deriva del curso, así que filtramos en memoria.
  const filas = await db
    .select({ id: eduTutorias.id, curso: eduTutorias.curso })
    .from(eduTutorias)
    .where(eq(eduTutorias.academicYear, academicYear));
  const ids = filas.filter((f) => etapaDeCurso(f.curso) === etapa).map((f) => f.id);
  if (ids.length === 0) return 0;
  await db.delete(eduTutorias).where(and(eq(eduTutorias.academicYear, academicYear), inArray(eduTutorias.id, ids)));
  const cursos = [...new Set(filas.filter((f) => etapaDeCurso(f.curso) === etapa).map((f) => f.curso))];
  if (cursos.length > 0) {
    await db
      .delete(eduRepartoConfirmado)
      .where(and(eq(eduRepartoConfirmado.academicYear, academicYear), inArray(eduRepartoConfirmado.curso, cursos)));
  }
  return ids.length;
}

export { academicYearActual };
