// Capa de servidor del Registro ABC sobre la nueva estructura: alumnado de la BBDD
// central (edu_students) con config propia del módulo en abc_students (destacados,
// emails de aviso) y profesorado por sesión (edu_teachers).
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { abcStudents, eduStudents, type AbcStudent } from '@/db/schema';
import { getTeacherByEmail } from '@/lib/educamos-server';

export interface DestacadoItem {
  abcStudentId: string;
  eduStudentId: string | null;
  nombre: string; // corto, para el chip
  detalle: string; // clase
}

export interface RosterItem {
  eduStudentId: string;
  nombre: string; // "Nombre Apellido1 Apellido2"
  clase: string; // "2ESO B"
}

function claseDe(curso: string | null, letra: string | null): string {
  if (!curso) return '';
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}

/** Alumnado destacado del formulario (configurado por el admin del módulo). */
export async function getDestacados(): Promise<DestacadoItem[]> {
  const rows = await db
    .select({ abc: abcStudents, edu: eduStudents })
    .from(abcStudents)
    .leftJoin(eduStudents, eq(abcStudents.eduStudentId, eduStudents.id))
    .where(and(eq(abcStudents.active, true), eq(abcStudents.destacado, true)));
  return rows.map(({ abc, edu }) => ({
    abcStudentId: abc.id,
    eduStudentId: abc.eduStudentId,
    nombre: abc.displayName || edu?.nombre || abc.fullName,
    detalle: edu ? claseDe(edu.curso, edu.letra) : abc.className,
  }));
}

/** Roster ligero de toda la BBDD central para el buscador del formulario. */
export async function getRosterLigero(): Promise<RosterItem[]> {
  const rows = await db
    .select({
      id: eduStudents.id,
      nombre: eduStudents.nombre,
      apellido1: eduStudents.apellido1,
      apellido2: eduStudents.apellido2,
      curso: eduStudents.curso,
      letra: eduStudents.letra,
    })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));
  return rows
    .map((r) => ({
      eduStudentId: r.id,
      nombre: [r.nombre, r.apellido1, r.apellido2].filter(Boolean).join(' '),
      clase: claseDe(r.curso, r.letra),
    }))
    .sort((a, b) => a.clase.localeCompare(b.clase) || a.nombre.localeCompare(b.nombre));
}

/**
 * Resuelve la fila de config abc_students para un registro nuevo: por id abc directo,
 * o por alumno de la BBDD central (autocreando la fila si aún no existe, sin destacar).
 */
export async function resolveAbcStudent(sel: { abcStudentId?: string; eduStudentId?: string }): Promise<AbcStudent | null> {
  if (sel.abcStudentId) {
    const [row] = await db.select().from(abcStudents).where(eq(abcStudents.id, sel.abcStudentId)).limit(1);
    return row ?? null;
  }
  if (!sel.eduStudentId) return null;
  const [existente] = await db.select().from(abcStudents).where(eq(abcStudents.eduStudentId, sel.eduStudentId)).limit(1);
  if (existente) return existente;
  const [edu] = await db.select().from(eduStudents).where(eq(eduStudents.id, sel.eduStudentId)).limit(1);
  if (!edu) return null;
  const nombreCompleto = [edu.nombre, edu.apellido1, edu.apellido2].filter(Boolean).join(' ');
  const [creado] = await db
    .insert(abcStudents)
    .values({
      eduStudentId: edu.id,
      fullName: nombreCompleto || '(sin nombre)',
      displayName: edu.nombre ?? nombreCompleto,
      className: claseDe(edu.curso, edu.letra),
      destacado: false,
      emailRecipients: [],
    })
    .returning();
  return creado;
}

/** Profesor de la sesión (edu_teachers por email del login), si es del claustro. */
export async function getTeacherFromSession(email: string) {
  return getTeacherByEmail(email);
}
