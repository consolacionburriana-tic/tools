// Capa de acceso común a la BBDD central Educamos (edu_*). Los módulos consumen
// alumnado/tutores desde aquí, nunca consultan las tablas edu_* a pelo.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { cookies } from 'next/headers';
import { db } from '@/db';
import {
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  eduSyncRuns,
  type EduGuardian,
  type EduStudent,
  type NewEduStudent,
} from '@/db/schema';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import {
  CODIGO_INTERNO_RE,
  claveGuardian,
  computeSyncPlan,
  dedupeGuardians,
  normalizar,
  type MatchTarget,
  type ParsedStudentRow,
  type StudentLike,
  type SyncOpciones,
  type SyncPlan,
} from '@/lib/educamos';

// Guard del módulo en UN solo helper: hoy reutiliza el login simple de /gestion
// (cookie de licencias-auth); en el hito 2 esta función pasa a ser requireModule('educamos')
// y este es el único sitio que hay que tocar.
export async function isEducamosAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

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

// ─── Sincronización desde export ──────────────────────────────────────────────

/** TODOS los alumnos (activos o no) con los campos que participan en el diff. */
async function getStudentsForSync(): Promise<StudentLike[]> {
  const rows = await db.select().from(eduStudents);
  return rows.map((s) => ({ ...s, extra: s.extra ?? null }));
}

/** Vista previa: parsea nada, recibe filas ya parseadas y calcula el plan contra la BBDD. */
export async function buildSyncPlan(
  rows: ParsedStudentRow[],
  opciones: SyncOpciones,
  parseWarnings: string[] = [],
): Promise<SyncPlan> {
  const existentes = await getStudentsForSync();
  return computeSyncPlan(rows, existentes, opciones, parseWarnings);
}

export interface SyncDecisiones {
  /** studentId → quién gana en los conflictos gordos de ese alumno. Sin entrada = BBDD (no tocar). */
  conflictos: Record<string, 'bbdd' | 'excel'>;
  /** studentIds del cubo "desaparecidos" que se marcan active=false (opt-in). */
  desactivar: string[];
}

export interface AplicarResultado {
  syncRunId: string;
  resumen: {
    altas: number;
    cambios: number;
    desactivados: number;
    conflictosResueltos: number;
    tutores: number;
    vinculos: number;
    errores: string[];
  };
}

/**
 * Aplica el sync: recalcula el plan en servidor (no se fía del cliente) y ejecuta todos los
 * upserts (alumnos + tutores + relaciones) y la fila de edu_sync_runs en UN db.batch(),
 * que el driver neon-http ejecuta como una única transacción.
 */
export async function aplicarSync(input: {
  rows: ParsedStudentRow[];
  opciones: SyncOpciones;
  decisiones: SyncDecisiones;
  filename: string;
  formato: string;
  parseWarnings?: string[];
}): Promise<AplicarResultado> {
  const { rows, opciones, decisiones, filename, formato } = input;
  const existentes = await getStudentsForSync();
  const plan = computeSyncPlan(rows, existentes, opciones, input.parseWarnings ?? []);
  const errores = [...plan.warnings];
  const ahora = new Date();

  const statements: BatchItem<'pg'>[] = [];

  // ── Alumnos: altas ──
  const filaToStudentId = new Map<number, string>();
  for (const alta of plan.altas) {
    const id = crypto.randomUUID();
    filaToStudentId.set(alta.fila, id);
    if (alta.colision) {
      errores.push(`Alta fila ${alta.fila}: colisión de código interno; se crea sin código (revisar a mano)`);
    }
    const r = alta.row;
    const nuevo: NewEduStudent = {
      id,
      codigo: alta.codigo,
      educamosPersonaId: r.educamosPersonaId,
      nia: r.nia,
      dni: r.dni,
      matricula: r.matricula,
      nombre: r.nombre,
      apellido1: r.apellido1,
      apellido2: r.apellido2,
      sexo: r.sexo,
      fechaNacimiento: r.fechaNacimiento,
      curso: r.curso,
      letra: r.letra,
      claseCodigo: r.claseCodigo,
      tutorPersonal: r.tutorPersonal,
      modeloLinguistico: r.modeloLinguistico,
      deficit: r.deficit,
      email: r.email,
      emailGoogle: r.emailGoogle,
      movil1: r.movil1,
      movil2: r.movil2,
      telEmergencia: r.telEmergencia,
      familiaId: r.familiaId,
      extra: Object.keys(r.extra).length ? r.extra : null,
      active: true,
      updatedAt: ahora,
      lastSyncedAt: ahora,
    };
    statements.push(db.insert(eduStudents).values(nuevo));
  }

  // ── Alumnos: cambios ──
  let conflictosResueltos = 0;
  const porId = new Map(existentes.map((e) => [e.id, e]));
  for (const cambio of plan.cambios) {
    filaToStudentId.set(cambio.row.fila, cambio.studentId);
    const decision = decisiones.conflictos[cambio.studentId] ?? 'bbdd';
    if (cambio.tieneGordos && decision === 'excel') conflictosResueltos++;
    const set: Record<string, unknown> = { updatedAt: ahora, lastSyncedAt: ahora };
    for (const d of cambio.diffs) {
      if (d.campo === 'extra') {
        set.extra = { ...(porId.get(cambio.studentId)?.extra ?? {}), ...cambio.row.extra };
      } else if (d.campo === 'active') {
        set.active = true;
      } else if (d.gordo) {
        if (decision === 'excel') set[d.campo] = d.nuevo;
      } else {
        set[d.campo] = d.nuevo;
      }
    }
    statements.push(db.update(eduStudents).set(set).where(eq(eduStudents.id, cambio.studentId)));
  }

  // ── Alumnos: sin cambios → solo lastSyncedAt (un único statement) ──
  const idsSinCambios = plan.sinCambios.map((s) => s.studentId);
  for (const s of plan.sinCambios) {
    // los tutores de estas filas también necesitan el vínculo fila→alumno
    const row = rows.find((r) => {
      const e = porId.get(s.studentId);
      return e && filaMatchesStudent(r, e);
    });
    if (row) filaToStudentId.set(row.fila, s.studentId);
  }
  if (idsSinCambios.length) {
    statements.push(
      db.update(eduStudents).set({ lastSyncedAt: ahora }).where(inArray(eduStudents.id, idsSinCambios)),
    );
  }

  // ── Desaparecidos: solo los que David marcó (y validados contra el plan) ──
  const desactivables = new Set(plan.desaparecidos.map((d) => d.studentId));
  const idsDesactivar = decisiones.desactivar.filter((id) => desactivables.has(id));
  if (idsDesactivar.length) {
    statements.push(
      db.update(eduStudents).set({ active: false, updatedAt: ahora }).where(inArray(eduStudents.id, idsDesactivar)),
    );
  }

  // ── Tutores: dedupe en memoria + match contra edu_guardians ──
  const { agrupados, sinClave } = dedupeGuardians(rows);
  if (sinClave > 0) errores.push(`${sinClave} tutores sin GUID/DNI/email: no se pueden dedupe, se omiten`);
  const guardiansExistentes = await db.select().from(eduGuardians);
  const porClave = new Map<string, EduGuardian>();
  for (const g of guardiansExistentes) {
    for (const clave of [
      g.educamosPersonaId ? `guid:${g.educamosPersonaId.toLowerCase()}` : null,
      g.dni ? `dni:${normalizar(g.dni)}` : null,
      g.email ? `email:${g.email.trim().toLowerCase()}` : null,
    ]) {
      if (clave && !porClave.has(clave)) porClave.set(clave, g);
    }
  }

  let vinculos = 0;
  for (const grupo of agrupados) {
    const d = grupo.datos;
    // La clave primaria de dedupe es la del grupo, pero probamos las tres por robustez
    const existente =
      porClave.get(grupo.clave) ??
      (d.dni ? porClave.get(`dni:${normalizar(d.dni)}`) : undefined) ??
      (d.email ? porClave.get(`email:${d.email.trim().toLowerCase()}`) : undefined);

    const guardianId = existente?.id ?? crypto.randomUUID();
    const campos = {
      educamosPersonaId: d.educamosPersonaId,
      nombre: d.nombre,
      apellido1: d.apellido1,
      apellido2: d.apellido2,
      dni: d.dni,
      sexo: d.sexo,
      email: d.email,
      emailGoogle: d.emailGoogle,
      telCasa: d.telCasa,
      telPersonal: d.telPersonal,
      movilTrabajo: d.movilTrabajo,
      direccion: d.direccion,
      cp: d.cp,
      localidad: d.localidad,
      provincia: d.provincia,
    };
    if (existente) {
      // Solo pisa con valores que el fichero trae; lo ausente no se toca
      const set: Record<string, unknown> = { updatedAt: ahora };
      for (const [k, v] of Object.entries(campos)) {
        if (v !== null && v !== existente[k as keyof EduGuardian]) set[k] = v;
      }
      if (Object.keys(d.extra).length) set.extra = { ...(existente.extra ?? {}), ...d.extra };
      if (Object.keys(set).length > 1) {
        statements.push(db.update(eduGuardians).set(set).where(eq(eduGuardians.id, guardianId)));
      }
    } else {
      statements.push(
        db.insert(eduGuardians).values({
          id: guardianId,
          ...campos,
          extra: Object.keys(d.extra).length ? d.extra : null,
          updatedAt: ahora,
        }),
      );
    }

    for (const v of grupo.vinculos) {
      const studentId = filaToStudentId.get(v.fila);
      if (!studentId) continue; // fila duplicada ignorada en el plan
      vinculos++;
      statements.push(
        db
          .insert(eduStudentGuardians)
          .values({
            studentId,
            guardianId,
            orden: v.orden,
            parentesco: v.parentesco,
            recibeInformacion: v.recibeInformacion,
            guardaCustodia: v.guardaCustodia,
          })
          .onConflictDoUpdate({
            target: [eduStudentGuardians.studentId, eduStudentGuardians.guardianId],
            set: {
              orden: v.orden,
              parentesco: v.parentesco,
              recibeInformacion: v.recibeInformacion,
              guardaCustodia: v.guardaCustodia,
            },
          }),
      );
    }
  }

  // ── Registro del sync ──
  const syncRunId = crypto.randomUUID();
  const resumen = {
    altas: plan.altas.length,
    cambios: plan.cambios.length,
    desactivados: idsDesactivar.length,
    conflictosResueltos,
    tutores: agrupados.length,
    vinculos,
    errores,
  };
  statements.push(
    db.insert(eduSyncRuns).values({
      id: syncRunId,
      filename,
      formato,
      resumen: { altas: resumen.altas, cambios: resumen.cambios, desactivados: resumen.desactivados, conflictosResueltos, errores },
      opciones: { ...opciones, desactivar: idsDesactivar },
    }),
  );

  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return { syncRunId, resumen };
}

/** ¿Esta fila parseada corresponde a este alumno? (mismas claves que la cascada de matching). */
function filaMatchesStudent(r: ParsedStudentRow, e: StudentLike): boolean {
  if (r.codigo && e.codigo && normalizar(r.codigo) === normalizar(e.codigo)) return true;
  if (r.educamosPersonaId && e.educamosPersonaId && r.educamosPersonaId.toLowerCase() === e.educamosPersonaId.toLowerCase()) return true;
  if (r.nia && e.nia && r.nia.trim() === e.nia.trim()) return true;
  if (r.dni && e.dni && normalizar(r.dni) === normalizar(e.dni)) return true;
  if (
    r.apellido1 && r.apellido2 && r.fechaNacimiento && e.apellido1 && e.apellido2 && e.fechaNacimiento &&
    normalizar(r.apellido1) === normalizar(e.apellido1) &&
    normalizar(r.apellido2) === normalizar(e.apellido2) &&
    r.fechaNacimiento === e.fechaNacimiento
  ) return true;
  return false;
}

export async function getSyncRuns(limit = 50) {
  return db.select().from(eduSyncRuns).orderBy(desc(eduSyncRuns.createdAt)).limit(limit);
}
