// Capa de servidor del Registro ABC sobre la nueva estructura: alumnado de la BBDD
// central (edu_students) enlazado por NIA, con config propia del módulo en abc_students
// (siglas, destacados, emails de aviso) y profesorado por sesión (edu_teachers).
//
// Regla del módulo: en abc_students NO hay nombres. Se guardan NIA + siglas; el nombre
// completo se resuelve contra edu_students solo donde hace falta (buscador del formulario
// y correo de aviso a las personas configuradas).
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { abcStudents, authUsers, eduStudents, eduTeachers, eduTutorias, type AbcStudent, type EduStudent } from '@/db/schema';
import { claseDeAlumno, normalizaNia, siglasDeAlumno } from '@/lib/abc';
import { academicYearActual } from '@/lib/constants';
import { getTeacherByEmail } from '@/lib/educamos-server';

export interface DestacadoItem {
  abcStudentId: string;
  eduStudentId: string | null;
  siglas: string;
  detalle: string; // clase
}

export interface RosterItem {
  eduStudentId: string;
  nombre: string; // "Nombre Apellido1 Apellido2" — solo para poder buscar
  siglas: string;
  clase: string; // "2ESO B"
}

/** Fila de config tal y como la pinta el panel: siglas + clase, nunca el nombre. */
export interface AbcStudentPanel {
  id: string;
  eduStudentId: string | null;
  nia: string | null;
  siglas: string;
  clase: string;
  destacado: boolean;
  active: boolean;
  emailRecipients: string[];
}

function siglasDe(abc: Pick<AbcStudent, 'siglas' | 'displayName'>, edu: EduStudent | null): string {
  if (abc.siglas) return abc.siglas;
  if (edu) return siglasDeAlumno(edu.nombre, edu.apellido1, edu.apellido2);
  return abc.displayName ?? '—';
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
    siglas: siglasDe(abc, edu),
    detalle: edu ? claseDeAlumno(edu.curso, edu.letra) : (abc.className ?? ''),
  }));
}

/** Config del módulo para el panel: siglas + clase resueltas de la BBDD central. */
export async function getAbcStudentsPanel(): Promise<AbcStudentPanel[]> {
  const rows = await db
    .select({ abc: abcStudents, edu: eduStudents })
    .from(abcStudents)
    .leftJoin(eduStudents, eq(abcStudents.eduStudentId, eduStudents.id));
  return rows
    .map(({ abc, edu }) => ({
      id: abc.id,
      eduStudentId: abc.eduStudentId,
      nia: abc.nia,
      siglas: siglasDe(abc, edu),
      clase: edu ? claseDeAlumno(edu.curso, edu.letra) : (abc.className ?? ''),
      destacado: abc.destacado,
      active: abc.active,
      emailRecipients: (abc.emailRecipients as string[]) ?? [],
    }))
    .sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.siglas.localeCompare(b.siglas));
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
      siglas: siglasDeAlumno(r.nombre, r.apellido1, r.apellido2),
      clase: claseDeAlumno(r.curso, r.letra),
    }))
    .sort((a, b) => a.clase.localeCompare(b.clase) || a.nombre.localeCompare(b.nombre));
}

/** Crea (o recupera) la config ABC de un alumno de la BBDD central. Sin nombres. */
export async function ensureAbcStudent(edu: EduStudent): Promise<AbcStudent> {
  const [existente] = await db.select().from(abcStudents).where(eq(abcStudents.eduStudentId, edu.id)).limit(1);
  if (existente) return existente;
  const [creado] = await db
    .insert(abcStudents)
    .values({
      eduStudentId: edu.id,
      nia: normalizaNia(edu.nia),
      siglas: siglasDeAlumno(edu.nombre, edu.apellido1, edu.apellido2),
      destacado: false,
      emailRecipients: [],
    })
    .returning();
  return creado;
}

/** Alumno de la BBDD central por NIA (la clave de vínculo del módulo). */
export async function getEduStudentByNia(nia: string): Promise<EduStudent | null> {
  const limpio = normalizaNia(nia);
  if (!limpio) return null;
  const [row] = await db.select().from(eduStudents).where(eq(eduStudents.nia, limpio)).limit(1);
  return row ?? null;
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
  const [edu] = await db.select().from(eduStudents).where(eq(eduStudents.id, sel.eduStudentId)).limit(1);
  if (!edu) return null;
  return ensureAbcStudent(edu);
}

/** Datos del alumno para el correo de aviso (destinatarios autorizados del alumno). */
export async function getAbcStudentParaEmail(abcStudentId: string) {
  const [row] = await db
    .select({ abc: abcStudents, edu: eduStudents })
    .from(abcStudents)
    .leftJoin(eduStudents, eq(abcStudents.eduStudentId, eduStudents.id))
    .where(eq(abcStudents.id, abcStudentId))
    .limit(1);
  if (!row) return null;
  const { abc, edu } = row;
  return {
    siglas: siglasDe(abc, edu),
    nombreCompleto: edu
      ? [edu.nombre, edu.apellido1, edu.apellido2].filter(Boolean).join(' ')
      : (abc.fullName ?? ''),
    clase: edu ? claseDeAlumno(edu.curso, edu.letra) : (abc.className ?? ''),
    emailRecipients: (abc.emailRecipients as string[]) ?? [],
  };
}

/** Profesor de la sesión (edu_teachers por email del login), si es del claustro. */
export async function getTeacherFromSession(email: string) {
  return getTeacherByEmail(email);
}

// ─── Destinatarios de los avisos ──────────────────────────────────────────────
// `abc_students.email_recipients` sigue siendo una lista de CORREOS (lo que se envía),
// pero se eligen personas, no se teclean direcciones: orientación primero, luego el
// tutor/a de la clase del alumno, luego el resto del claustro, y como último recurso un
// correo suelto (familias, externos). Aquí se resuelven esas opciones y las etiquetas
// con las que el panel pinta los correos ya guardados.

export interface PersonaDestinataria {
  email: string;
  nombre: string;
  etiqueta: string; // 'Orientación' · 'Tutor/a de 3ºPPDC' · 'Secundaria'
  motivo: 'orientacion' | 'tutor' | 'claustro';
}

export interface DirectorioDestinatarios {
  sugeridos: PersonaDestinataria[]; // 1 toque: orientación + tutor/a del alumno
  claustro: PersonaDestinataria[]; // buscador (incluye a los sugeridos)
}

const ETAPA_LABEL: Record<string, string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };

/**
 * Opciones de destinatarios para un alumno del ABC: el claustro con etiqueta y los
 * sugeridos (orientación + tutor/a de su clase de este curso académico).
 */
export async function getDirectorioDestinatarios(abcStudentId: string): Promise<DirectorioDestinatarios> {
  const [row] = await db
    .select({ abc: abcStudents, edu: eduStudents })
    .from(abcStudents)
    .leftJoin(eduStudents, eq(abcStudents.eduStudentId, eduStudents.id))
    .where(eq(abcStudents.id, abcStudentId))
    .limit(1);

  const edu = row?.edu ?? null;
  const clase = edu ? claseDeAlumno(edu.curso, edu.letra) : '';

  const [profes, usuarios, tutorias] = await Promise.all([
    db.select().from(eduTeachers).where(eq(eduTeachers.active, true)),
    db.select().from(authUsers).where(eq(authUsers.active, true)),
    edu?.curso
      ? db.select().from(eduTutorias).where(
          and(
            eq(eduTutorias.academicYear, academicYearActual()),
            eq(eduTutorias.curso, edu.curso),
            edu.letra ? eq(eduTutorias.letra, edu.letra) : isNull(eduTutorias.letra),
          ),
        )
      : Promise.resolve([]),
  ]);

  const rolPorEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.role]));
  const tutoresDelAlumno = new Set(tutorias.map((t) => t.eduTeacherId));

  const claustro: PersonaDestinataria[] = [];
  const vistos = new Set<string>();

  for (const p of profes) {
    const email = p.email?.toLowerCase();
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    const esOrientacion = rolPorEmail.get(email) === 'orientacion';
    const esTutorDelAlumno = tutoresDelAlumno.has(p.id);
    claustro.push({
      email,
      nombre: [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ') || email,
      etiqueta: esOrientacion
        ? 'Orientación'
        : esTutorDelAlumno
          ? `Tutor/a de ${clase || 'su clase'}`
          : (ETAPA_LABEL[p.etapa ?? ''] ?? 'Claustro'),
      motivo: esOrientacion ? 'orientacion' : esTutorDelAlumno ? 'tutor' : 'claustro',
    });
  }

  // Orientación que no está en el claustro de Educamos (cuentas de departamento, etc.)
  for (const u of usuarios) {
    const email = u.email.toLowerCase();
    if (u.role !== 'orientacion' || vistos.has(email)) continue;
    vistos.add(email);
    claustro.push({ email, nombre: u.nombre ?? email, etiqueta: 'Orientación', motivo: 'orientacion' });
  }

  const orden = { orientacion: 0, tutor: 1, claustro: 2 } as const;
  claustro.sort((a, b) => orden[a.motivo] - orden[b.motivo] || a.nombre.localeCompare(b.nombre));

  return { sugeridos: claustro.filter((p) => p.motivo !== 'claustro'), claustro };
}
