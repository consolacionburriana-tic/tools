// AUTOASM · lo único que este módulo lee de la base de datos: quién hay en el centro.
//
// Se piden SOLO las columnas que acaban en los CSV de Apple School Manager (nombre,
// apellidos, curso y correo). Ni teléfonos, ni DNI, ni familias: lo que no se pide no
// puede acabar por error en un fichero que se sube a un servicio de fuera.

import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  authUsers,
  eduStudents,
  eduTeachers,
  eduTutorias,
  horActividades,
  horAsignacionGrupos,
  horAsignacionProfes,
  horAsignaciones,
  horMaterias,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { getPeriodoVigente } from '@/lib/horarios-server';
import type { EquiposCentro, SnapshotCentro } from '@/lib/autoasm-construir';
import type { AsignacionHorario } from '@/lib/autoasm-horario';

export async function getSnapshotCentro(): Promise<SnapshotCentro> {
  const academicYear = academicYearActual();
  const [alumnos, profes, equipos] = await Promise.all([
    db
      .select({
        nia: eduStudents.nia,
        codigo: eduStudents.codigo,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
        email: eduStudents.email,
        emailGoogle: eduStudents.emailGoogle,
      })
      .from(eduStudents)
      .where(eq(eduStudents.active, true))
      .orderBy(asc(eduStudents.curso), asc(eduStudents.letra), asc(eduStudents.apellido1)),
    db
      .select({
        alias: eduTeachers.alias,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        email: eduTeachers.email,
      })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true))
      .orderBy(asc(eduTeachers.apellido1), asc(eduTeachers.nombre)),
    getEquiposCentro(academicYear),
  ]);

  return { alumnos, profes, equipos, generado: new Date().toISOString() };
}

/**
 * Quién entra solo en qué clase: los tutores de cada grupo del curso en vigor, el equipo
 * TIC y dirección/jefatura. Los dos últimos salen de los ROLES del login (`auth_users`),
 * que es donde ya se decide quién es quién en la plataforma — así no hay una segunda
 * lista que mantener.
 */
export async function getEquiposCentro(academicYear = academicYearActual()): Promise<EquiposCentro> {
  const [tutorias, usuarios] = await Promise.all([
    db
      .select({
        curso: eduTutorias.curso,
        letra: eduTutorias.letra,
        email: eduTeachers.email,
      })
      .from(eduTutorias)
      .innerJoin(eduTeachers, eq(eduTutorias.eduTeacherId, eduTeachers.id))
      .where(eq(eduTutorias.academicYear, academicYear)),
    db
      .select({ email: authUsers.email, role: authUsers.role })
      .from(authUsers)
      .where(and(eq(authUsers.active, true), inArray(authUsers.role, ['tic', 'supertic', 'direccion', 'jefe']))),
  ]);

  return {
    tutorias: tutorias
      .filter((t): t is { curso: string; letra: string | null; email: string } => !!t.email)
      .map((t) => ({ ...t, email: t.email.toLowerCase() })),
    tic: usuarios.filter((u) => u.role === 'tic' || u.role === 'supertic').map((u) => u.email.toLowerCase()),
    direccion: usuarios.filter((u) => u.role === 'direccion' || u.role === 'jefe').map((u) => u.email.toLowerCase()),
  };
}

/**
 * Las asignaciones docentes del periodo en vigor, que es de donde salen las clases de ASM:
 * qué materia, a qué grupo(s) y con qué profe(s). Solo las **lectivas de tipo clase**: una
 * guardia o una reunión de departamento no es una clase de Apple School Manager.
 *
 * Ojo: hoy `hor_*` tiene infantil y primaria; secundaria entrará cuando David tenga su
 * fichero. Lo que no está en el horario no se toca, solo se avisa.
 */
export async function getAsignacionesHorario(periodoId?: string): Promise<{ asignaciones: AsignacionHorario[]; periodo: string | null }> {
  const periodo = periodoId ? { id: periodoId, nombre: '' } : await getPeriodoVigente();
  if (!periodo) return { asignaciones: [], periodo: null };

  const filas = await db
    .select({
      id: horAsignaciones.id,
      materia: horMaterias.nombre,
      abreviatura: horMaterias.abreviatura,
    })
    .from(horAsignaciones)
    .innerJoin(horActividades, eq(horAsignaciones.actividadId, horActividades.id))
    .innerJoin(horMaterias, eq(horAsignaciones.materiaId, horMaterias.id))
    .where(and(eq(horAsignaciones.periodoId, periodo.id), eq(horAsignaciones.active, true), eq(horActividades.codigo, 'clase')));

  if (filas.length === 0) return { asignaciones: [], periodo: periodo.id };
  const ids = filas.map((f) => f.id);

  const [grupos, profes] = await Promise.all([
    db
      .select({
        asignacionId: horAsignacionGrupos.asignacionId,
        curso: horAsignacionGrupos.curso,
        letra: horAsignacionGrupos.letra,
        subgrupo: horAsignacionGrupos.subgrupo,
      })
      .from(horAsignacionGrupos)
      .where(inArray(horAsignacionGrupos.asignacionId, ids)),
    db
      .select({
        asignacionId: horAsignacionProfes.asignacionId,
        email: eduTeachers.email,
        principal: horAsignacionProfes.principal,
      })
      .from(horAsignacionProfes)
      .innerJoin(eduTeachers, eq(horAsignacionProfes.eduTeacherId, eduTeachers.id))
      .where(inArray(horAsignacionProfes.asignacionId, ids)),
  ]);

  const gruposPor = new Map<string, AsignacionHorario['grupos']>();
  for (const g of grupos) {
    const lista = gruposPor.get(g.asignacionId) ?? [];
    lista.push({ curso: g.curso, letra: g.letra, subgrupo: g.subgrupo });
    gruposPor.set(g.asignacionId, lista);
  }
  const profesPor = new Map<string, { email: string; principal: boolean }[]>();
  for (const p of profes) {
    if (!p.email) continue;
    const lista = profesPor.get(p.asignacionId) ?? [];
    lista.push({ email: p.email.toLowerCase(), principal: p.principal });
    profesPor.set(p.asignacionId, lista);
  }

  return {
    periodo: periodo.id,
    asignaciones: filas.map((f) => ({
      id: f.id,
      materia: f.materia,
      abreviatura: f.abreviatura,
      grupos: gruposPor.get(f.id) ?? [],
      // El titular primero: en ASM el primer instructor es el que manda en la clase.
      profes: (profesPor.get(f.id) ?? [])
        .sort((a, b) => Number(b.principal) - Number(a.principal))
        .map((p) => p.email),
    })),
  };
}
