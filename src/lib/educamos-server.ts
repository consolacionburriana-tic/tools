// Capa de acceso común a la BBDD central Educamos (edu_*). Los módulos consumen
// alumnado/tutores desde aquí, nunca consultan las tablas edu_* a pelo.
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  type EduGuardian,
  type EduStudent,
} from '@/db/schema';
import { CODIGO_INTERNO_RE, normalizar, type MatchTarget } from '@/lib/educamos';

export interface GetStudentsFilters {
  curso?: string;
  letra?: string;
  bancoLibros?: boolean;
  active?: boolean; // por defecto solo activos
}

export async function getStudents(filters: GetStudentsFilters = {}): Promise<EduStudent[]> {
  const conds = [eq(eduStudents.active, filters.active ?? true)];
  if (filters.curso) conds.push(eq(eduStudents.curso, filters.curso));
  if (filters.letra) conds.push(eq(eduStudents.letra, filters.letra));
  if (filters.bancoLibros !== undefined) conds.push(eq(eduStudents.bancoLibros, filters.bancoLibros));
  return db
    .select()
    .from(eduStudents)
    .where(and(...conds))
    .orderBy(asc(eduStudents.curso), asc(eduStudents.letra), asc(eduStudents.apellido1), asc(eduStudents.apellido2));
}

/** Busca por UUID o por código interno (14PONROS). */
export async function getStudent(idOrCodigo: string): Promise<EduStudent | null> {
  const esCodigo = CODIGO_INTERNO_RE.test(normalizar(idOrCodigo));
  const [row] = await db
    .select()
    .from(eduStudents)
    .where(esCodigo ? eq(eduStudents.codigo, normalizar(idOrCodigo)) : eq(eduStudents.id, idOrCodigo))
    .limit(1);
  return row ?? null;
}

export interface StudentGuardian extends EduGuardian {
  orden: number | null;
  parentesco: string | null;
  recibeInformacion: boolean | null;
  guardaCustodia: boolean | null;
}

export async function getGuardians(studentId: string): Promise<StudentGuardian[]> {
  const rows = await db
    .select({
      guardian: eduGuardians,
      orden: eduStudentGuardians.orden,
      parentesco: eduStudentGuardians.parentesco,
      recibeInformacion: eduStudentGuardians.recibeInformacion,
      guardaCustodia: eduStudentGuardians.guardaCustodia,
    })
    .from(eduStudentGuardians)
    .innerJoin(eduGuardians, eq(eduStudentGuardians.guardianId, eduGuardians.id))
    .where(eq(eduStudentGuardians.studentId, studentId))
    .orderBy(asc(eduStudentGuardians.orden));
  return rows.map((r) => ({
    ...r.guardian,
    orden: r.orden,
    parentesco: r.parentesco,
    recibeInformacion: r.recibeInformacion,
    guardaCustodia: r.guardaCustodia,
  }));
}

/** Carga los campos mínimos de TODOS los alumnos (activos o no) para la cascada de matching del sync. */
export async function getMatchTargets(): Promise<MatchTarget[]> {
  return db
    .select({
      id: eduStudents.id,
      codigo: eduStudents.codigo,
      educamosPersonaId: eduStudents.educamosPersonaId,
      nia: eduStudents.nia,
      dni: eduStudents.dni,
      apellido1: eduStudents.apellido1,
      apellido2: eduStudents.apellido2,
      fechaNacimiento: eduStudents.fechaNacimiento,
    })
    .from(eduStudents);
}
