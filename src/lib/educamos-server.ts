// Capa de acceso común a la BBDD central Educamos (edu_*). Los módulos consumen
// alumnado/tutores desde aquí, nunca consultan las tablas edu_* a pelo.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { valorACodigo, type FilaAuditoria } from '@/lib/auditoria';
import { claseLarga } from '@/lib/alumnado';
import {
  audCambios,
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  eduSustituciones,
  eduSyncRuns,
  eduTeachers,
  licCampaigns,
  type EduGuardian,
  type EduStudent,
  type EduTeacher,
  type NewEduStudent,
} from '@/db/schema';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { COLEGIO } from '@/lib/colegio';
import { correosProfeTrasSync } from '@/lib/cuentas';
import { bancoTrasCambioDeCurso, etapaDeCurso, type Etapa } from '@/lib/cursos';
import {
  CODIGO_INTERNO_RE,
  computeSyncPlan,
  dedupeGuardians,
  normalizar,
  type ParsedStudentRow,
  type ParsedTeacherRow,
  type StudentLike,
  type SyncOpciones,
  type SyncPlan,
} from '@/lib/educamos';
import { candidatoDeExtra, planSustitucionesEducamos, type CandidatoSustituto, type ProfeParaTitular } from '@/lib/sustituciones';
import { resumenDePlan, sentenciasDePlan, type ResumenSustituciones } from '@/lib/sustituciones-server';
import { hoyISO } from '@/lib/tableros';

// Guard del módulo en UN solo helper (rol con módulo 'educamos').
export async function isEducamosAdmin(): Promise<boolean> {
  return hasModule('educamos');
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


// ─── Sincronización desde export ──────────────────────────────────────────────

/** TODOS los alumnos (activos o no) con los campos que participan en el diff. */
async function getStudentsForSync(): Promise<(StudentLike & { bancoLibros: boolean })[]> {
  const rows = await db.select().from(eduStudents);
  return rows.map((s) => ({ ...s, extra: s.extra ?? null }));
}

/** ¿Hay alguna campaña de Licencias abierta ahora mismo? Para avisar de altas en su rango. */
async function hayLicenciasAbierta(): Promise<boolean> {
  const [abierta] = await db.select({ id: licCampaigns.id }).from(licCampaigns).where(eq(licCampaigns.status, 'open')).limit(1);
  return !!abierta;
}

/** Vista previa: parsea nada, recibe filas ya parseadas y calcula el plan contra la BBDD. */
export async function buildSyncPlan(
  rows: ParsedStudentRow[],
  opciones: SyncOpciones,
  parseWarnings: string[] = [],
  omitidas: ParsedStudentRow[] = [],
): Promise<SyncPlan> {
  const [existentes, licenciasAbierta] = await Promise.all([getStudentsForSync(), hayLicenciasAbierta()]);
  return computeSyncPlan(rows, existentes, opciones, parseWarnings, licenciasAbierta, omitidas);
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
    /** Qué ha pasado con las altas en Nouvinguts (null si no había altas o falló). */
    nouvinguts?: { nuevos: number; vinculados: number; dudosos: number; inicioCurso: number } | null;
    /** Cuántas altas han entrado solas en la campaña de Licencias (null si no había campaña o falló). */
    licencias?: { campana: string; altas: number } | null;
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
  omitidas?: ParsedStudentRow[];
}): Promise<AplicarResultado> {
  const { rows, opciones, decisiones, filename, formato } = input;
  const [existentes, licenciasAbierta] = await Promise.all([getStudentsForSync(), hayLicenciasAbierta()]);
  const plan = computeSyncPlan(rows, existentes, opciones, input.parseWarnings ?? [], licenciasAbierta, input.omitidas ?? []);
  const errores = [...plan.warnings];
  const ahora = new Date();

  const statements: BatchItem<'pg'>[] = [];
  // Libro de cambios: el sync anota altas, bajas, cambios de clase y el banco que sigue al curso,
  // pero NO se pueden restaurar desde ahí (David, 3-nov-2026: «se puede anotar y nada más»).
  const lote = crypto.randomUUID();
  const registro: FilaAuditoria[] = [];
  const anota = (
    alumno: { id: string; nombre: string | null; apellido1: string | null; apellido2: string | null; curso: string | null; letra: string | null },
    campo: FilaAuditoria['campo'],
    antes: string | null,
    despues: string | null,
  ) =>
    registro.push({
      lote,
      por: null,
      origen: 'educamos',
      eduStudentId: alumno.id,
      alumno: [alumno.nombre, alumno.apellido1, alumno.apellido2].filter(Boolean).join(' '),
      clase: claseLarga(alumno.curso, alumno.letra),
      campo,
      antes,
      despues,
    });

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
      // Sin esto la columna nace a `true` (su DEFAULT) también en Infantil y 1º-2º EP.
      bancoLibros: bancoTrasCambioDeCurso(null, r.curso) ?? false,
      extra: Object.keys(r.extra).length ? r.extra : null,
      active: true,
      updatedAt: ahora,
      lastSyncedAt: ahora,
    };
    statements.push(db.insert(eduStudents).values(nuevo));
    anota({ id, nombre: r.nombre, apellido1: r.apellido1, apellido2: r.apellido2, curso: r.curso, letra: r.letra }, 'alta', null, claseLarga(r.curso, r.letra));
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
    // Cambio de curso que cruza la frontera del banco (2º → 3º EP): la casilla la sigue.
    if (typeof set.curso === 'string') {
      const banco = bancoTrasCambioDeCurso(porId.get(cambio.studentId)?.curso ?? null, set.curso);
      if (banco !== null) set.bancoLibros = banco;
    }
    // Para el libro de cambios (con la clase de ANTES en el nombre, que es lo que se quiere ver).
    const previo = porId.get(cambio.studentId);
    if (previo) {
      if (set.active === true && !previo.active) anota(previo, 'reactivado', 'inactivo', 'activo');
      if ('curso' in set || 'letra' in set) {
        const nuevoCurso = 'curso' in set ? (set.curso as string | null) : previo.curso;
        const nuevaLetra = 'letra' in set ? (set.letra as string | null) : previo.letra;
        const antesClase = claseLarga(previo.curso, previo.letra);
        const despuesClase = claseLarga(nuevoCurso, nuevaLetra);
        if (antesClase !== despuesClase) anota(previo, 'clase', antesClase, despuesClase);
      }
      if (typeof set.bancoLibros === 'boolean' && set.bancoLibros !== previo.bancoLibros) {
        anota(previo, 'banco', valorACodigo(previo.bancoLibros), valorACodigo(set.bancoLibros));
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
    for (const id of idsDesactivar) {
      const previo = porId.get(id);
      if (previo) anota(previo, 'baja', 'activo', 'inactivo');
    }
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
      tipo: 'alumnado',
      filename,
      formato,
      quienEmail: (await getSessionUser())?.email ?? null,
      resumen: {
        altas: resumen.altas,
        cambios: resumen.cambios,
        desactivados: resumen.desactivados,
        conflictosResueltos,
        tutores: resumen.tutores,
        vinculos: resumen.vinculos,
        errores,
      },
      opciones: { ...opciones, desactivar: idsDesactivar },
    }),
  );

  // Las anotaciones van en el mismo batch (misma transacción) que los cambios que anotan.
  for (let i = 0; i < registro.length; i += 500) statements.push(db.insert(audCambios).values(registro.slice(i, i + 500)));
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

  // ── Licencias: las altas en un curso con Licencias entran solas en la campaña vigente ──
  // Antes había que acordarse de ejecutar el sync de Licencias, y quien no estaba en la campaña
  // no podía hacer el pedido (docs/06-fuente-unica-alumnado.md, fase 3). Solo altas; las bajas
  // siguen siendo una decisión con vista previa. Va ANTES que Nouvinguts, que mira si el alumno
  // ya está en la campaña. Después del batch: si falla, el sync ya está hecho y solo se avisa.
  let licencias: AplicarResultado['resumen']['licencias'] = null;
  if (plan.altas.length) {
    try {
      const { darDeAltaEnCampania } = await import('@/lib/licencias-server');
      const r = await darDeAltaEnCampania(plan.altas.flatMap((a) => filaToStudentId.get(a.fila) ?? []));
      licencias = r ? { campana: r.campaignName, altas: r.altas } : null;
    } catch (error) {
      console.error('Licencias tras el sync:', error instanceof Error ? error.message : error);
      errores.push('Las altas no han entrado en la campaña de Licencias: añádelas desde Licencias → Sincronizar');
    }
  }

  // ── Nouvinguts: toda alta nueva entra en su ciclo (y se vincula con lo apuntado a mano) ──
  // Después del batch y fuera de él: si fallara, el sync ya está hecho y solo se avisa. Import
  // dinámico porque nouvinguts-server tira de licencias-server, que importa este fichero.
  let nouvinguts: AplicarResultado['resumen']['nouvinguts'] = null;
  if (plan.altas.length) {
    try {
      const { avisarAltas, registrarAltas } = await import('@/lib/nouvinguts-server');
      const { hoyISO } = await import('@/lib/tableros');
      const hoy = hoyISO(ahora);
      const { nuevosIds = [], ...cuenta } = await registrarAltas(
        plan.altas.flatMap((a) => {
          const id = filaToStudentId.get(a.fila);
          return id ? [{ id, nombre: a.row.nombre, apellido1: a.row.apellido1, apellido2: a.row.apellido2, curso: a.row.curso, fecha: hoy }] : [];
        }),
      );
      nouvinguts = cuenta;
      // «Llegan nuevos»: un solo correo con la lista (a TIC por defecto). No lanza.
      await avisarAltas(nuevosIds, null);
    } catch (error) {
      console.error('Nouvinguts tras el sync:', error instanceof Error ? error.message : error);
      errores.push('Las altas no han entrado en Nouvinguts: tráelas desde Nouvinguts → Proceso');
    }
  }
  return { syncRunId, resumen: { ...resumen, nouvinguts, licencias } };
}

// ─── Profesorado ──────────────────────────────────────────────────────────────

export async function getTeachers(filters: { active?: boolean } = {}): Promise<EduTeacher[]> {
  const conds = [eq(eduTeachers.active, filters.active ?? true)];
  return db
    .select()
    .from(eduTeachers)
    .where(and(...conds))
    .orderBy(asc(eduTeachers.apellido1), asc(eduTeachers.apellido2), asc(eduTeachers.nombre));
}

/**
 * Fija (o borra) el nombre visible de un profe: el "given name" que sale en TODAS partes
 * (ASM, cuaderno, correos, paneles). En blanco = se vuelve a la heurística de
 * `nombreDePila()` sobre lo que diga Educamos. El sync no lo toca nunca.
 */
export async function fijarNombreMostrado(teacherId: string, nombre: string | null): Promise<EduTeacher | null> {
  const limpio = nombre?.replace(/\s+/g, ' ').trim() || null;
  const [fila] = await db
    .update(eduTeachers)
    .set({ nombreMostrado: limpio, updatedAt: new Date() })
    .where(eq(eduTeachers.id, teacherId))
    .returning();
  return fila ?? null;
}

/** Las etapas elegidas a mano de un profe (multiselección). Lista vacía = ninguna. */
export async function fijarEtapasProfe(teacherId: string, etapas: Etapa[]): Promise<EduTeacher | null> {
  const [fila] = await db
    .update(eduTeachers)
    .set({ etapas, updatedAt: new Date() })
    .where(eq(eduTeachers.id, teacherId))
    .returning();
  return fila ?? null;
}

export async function getTeacherByEmail(email: string): Promise<EduTeacher | null> {
  const [row] = await db
    .select()
    .from(eduTeachers)
    .where(eq(eduTeachers.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert de profesorado desde el export (dedupe GUID → alias → DNI → email).
 * active = sin fecha de baja. Mismo espíritu que el sync de alumnado, en una transacción.
 */
export async function aplicarSyncProfesores(input: {
  rows: ParsedTeacherRow[];
  filename: string;
  formato: string;
  parseWarnings?: string[];
  dryRun?: boolean;
}): Promise<{
  altas: number;
  cambios: number;
  sinCambios: number;
  bajas: number;
  errores: string[];
  sustituciones: ResumenSustituciones;
}> {
  const { rows, filename, formato, dryRun } = input;
  const errores = [...(input.parseWarnings ?? [])];
  const [existentes, sustExistentes] = await Promise.all([
    db.select().from(eduTeachers),
    db.select().from(eduSustituciones),
  ]);
  const porClave = new Map<string, EduTeacher>();
  for (const t of existentes) {
    for (const clave of [
      t.educamosPersonaId ? `guid:${t.educamosPersonaId.toLowerCase()}` : null,
      t.alias ? `alias:${t.alias}` : null,
      t.dni ? `dni:${normalizar(t.dni)}` : null,
      t.email ? `email:${t.email}` : null,
    ]) {
      if (clave && !porClave.has(clave)) porClave.set(clave, t);
    }
  }

  const ahora = new Date();
  const statements: BatchItem<'pg'>[] = [];
  let altas = 0, cambios = 0, sinCambios = 0, bajas = 0;
  // Quién sustituye a quién según este fichero (se resuelve al final, con todos los profes ya a la vista).
  const candidatos: CandidatoSustituto[] = [];
  const paraTitular = new Map<string, ProfeParaTitular>(
    existentes.map((t) => [t.id, { id: t.id, nombre: t.nombre, apellido1: t.apellido1, apellido2: t.apellido2, active: t.active }]),
  );

  for (const r of rows) {
    const existente =
      (r.educamosPersonaId && porClave.get(`guid:${r.educamosPersonaId.toLowerCase()}`)) ||
      (r.alias && porClave.get(`alias:${r.alias}`)) ||
      (r.dni && porClave.get(`dni:${normalizar(r.dni)}`)) ||
      (r.email && porClave.get(`email:${r.email}`)) ||
      null;

    const activo = r.fechaBaja === null;
    // El correo del colegio (el de su cuenta de Google y el login) no lo pisa uno personal.
    const correos = correosProfeTrasSync(existente, { email: r.email, emailOtro: r.emailOtro }, COLEGIO.dominio);
    const campos = {
      alias: r.alias,
      educamosPersonaId: r.educamosPersonaId,
      nombre: r.nombre,
      apellido1: r.apellido1,
      apellido2: r.apellido2,
      dni: r.dni,
      sexo: r.sexo,
      fechaNacimiento: r.fechaNacimiento,
      email: correos.email,
      emailOtro: correos.emailOtro,
      movilPersonal: r.movilPersonal,
      fechaAlta: r.fechaAlta,
      fechaBaja: r.fechaBaja,
      esTutor: r.esTutor,
      claseTutor: r.claseTutor,
      // Etapa: en tutores se deriva de la clase; en no-tutores se deja a mano (null no pisa).
      etapa: r.esTutor ? etapaDeCurso(r.claseTutor) : null,
    };
    // El id de un alta se fija aquí (no lo deja a la BBDD) para que una sustitución del mismo
    // fichero pueda apuntar a ella dentro del mismo batch.
    const idProfe = existente?.id ?? crypto.randomUUID();
    paraTitular.set(idProfe, { id: idProfe, nombre: r.nombre, apellido1: r.apellido1, apellido2: r.apellido2, active: activo });
    candidatos.push(candidatoDeExtra(idProfe, r.extra, { fechaAlta: r.fechaAlta, fechaBaja: r.fechaBaja }));
    if (!existente) {
      altas++;
      if (!activo) bajas++;
      statements.push(
        db.insert(eduTeachers).values({
          ...campos,
          id: idProfe,
          active: activo,
          extra: Object.keys(r.extra).length ? r.extra : null,
          lastSyncedAt: ahora,
          updatedAt: ahora,
        }),
      );
    } else {
      const set: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(campos)) {
        // esTutor/claseTutor y fechaBaja pueden "vaciarse" de un curso a otro: se pisan siempre
        const pisaSiempre = k === 'esTutor' || k === 'claseTutor' || k === 'fechaBaja';
        if ((v !== null || pisaSiempre) && v !== existente[k as keyof EduTeacher]) set[k] = v;
      }
      if (activo !== existente.active) {
        set.active = activo;
        if (!activo) bajas++;
      }
      if (Object.keys(r.extra).length) {
        const mezclado = { ...(existente.extra ?? {}), ...r.extra };
        if (JSON.stringify(mezclado) !== JSON.stringify(existente.extra ?? {})) set.extra = mezclado;
      }
      if (Object.keys(set).length === 0) {
        sinCambios++;
        statements.push(db.update(eduTeachers).set({ lastSyncedAt: ahora }).where(eq(eduTeachers.id, existente.id)));
      } else {
        cambios++;
        statements.push(
          db.update(eduTeachers).set({ ...set, updatedAt: ahora, lastSyncedAt: ahora }).where(eq(eduTeachers.id, existente.id)),
        );
      }
    }
  }

  // Sustituciones: PROF. SUSTITUTO + PROF. TITULAR → `edu_sustituciones` (lo manual no se toca).
  // Los avisos (titular que no se encuentra…) salen junto a los demás del fichero.
  const planSust = planSustitucionesEducamos(candidatos, [...paraTitular.values()], sustExistentes, hoyISO(ahora));
  const sustituciones = resumenDePlan(planSust);
  errores.push(...planSust.avisos);

  const resumen = { altas, cambios, sinCambios, bajas, errores, sustituciones };
  if (!dryRun) {
    statements.push(...sentenciasDePlan(planSust, ahora));
    statements.push(
      db.insert(eduSyncRuns).values({
        tipo: 'profesorado',
        filename,
        formato,
        quienEmail: (await getSessionUser())?.email ?? null,
        resumen: {
          altas,
          cambios,
          desactivados: bajas,
          conflictosResueltos: 0,
          sinCambios,
          errores,
          sustituciones: { nuevas: sustituciones.nuevas, actualizadas: sustituciones.actualizadas, apagadas: sustituciones.apagadas },
        },
      }),
    );
    await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  }
  return resumen;
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
