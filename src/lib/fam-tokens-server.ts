// Generación y mantenimiento de los tokens de acceso de familias (magic links).
//
// Modelo mental: **un token = un correo de familia + los hijos que ese correo gestiona**.
// No es "un token por alumno" porque el caso real es el contrario: el mismo correo puede
// tener varios hijos en el colegio (y puede estar dado de alta como tutor distinto en cada
// uno), y lo que la familia quiere es UN enlace que le abra todos.
//
// Reglas cerradas (ver docs/11-licencias-v2.md):
//  - Se agrupa por **correo** (normalizado a minúsculas), no por tutor: si padre y madre
//    comparten correo, es un único destinatario y un único enlace.
//  - El token cubre **todos los hijos activos** de esos tutores, aunque el hermano esté en
//    otra clase o etapa. Cada módulo ya filtra lo que puede pedir (Licencias solo muestra
//    los que están en la campaña).
//  - Es **multiuso** y se **reutiliza** mientras siga vigente: regenerar no invalida los
//    enlaces ya enviados. Para invalidarlos hay que revocar explícitamente.
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  famAccessTokens,
  type FamAccessToken,
  type NewFamAccessToken,
} from '@/db/schema';
import { nuevoTokenFamilia, type PropositoToken } from '@/lib/familias';

/** Familia destinataria: un correo, sus tutores y sus hijos. */
export interface FamiliaDestino {
  email: string; // normalizado (minúsculas, sin espacios)
  tutorNombre: string | null; // primer tutor con ese correo, para el saludo del email
  guardianIds: string[];
  hijosObjetivo: string[]; // ids de edu_students del grupo pedido que le corresponden
  hijosTodos: string[]; // ids de TODOS sus hijos activos: lo que cubrirá el token
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(valor: string | null | undefined): string | null {
  const e = (valor ?? '').trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

/** Fila cruda tutor↔alumno, tal como sale de la BBDD central. */
export interface FilaTutor {
  studentId: string;
  orden: number | null; // 1 = TUTOR1, 2 = TUTOR2
  guardianId: string;
  nombre: string | null;
  apellido1: string | null;
  email: string | null;
  emailGoogle: string | null;
}

/**
 * Agrupa las filas tutor↔alumno por **correo**. Es la pieza que hace que una familia con
 * varios hijos reciba un solo enlace, incluso si cada hijo la tiene registrada como un
 * tutor distinto (pasa en Educamos). Pura, para poder verificarla sin BBDD.
 */
export function agruparPorCorreo(filas: FilaTutor[]): {
  familias: FamiliaDestino[];
  alumnosConCorreo: Set<string>;
} {
  const porEmail = new Map<string, FamiliaDestino>();
  const alumnosConCorreo = new Set<string>();
  // Orden estable: TUTOR1 antes que TUTOR2, para que el nombre del saludo sea el principal.
  for (const f of [...filas].sort((a, b) => (a.orden ?? 9) - (b.orden ?? 9))) {
    const email = normalizarEmail(f.email) ?? normalizarEmail(f.emailGoogle);
    if (!email) continue;
    alumnosConCorreo.add(f.studentId);
    const fam: FamiliaDestino =
      porEmail.get(email) ?? { email, tutorNombre: null, guardianIds: [], hijosObjetivo: [], hijosTodos: [] };
    if (!fam.tutorNombre) fam.tutorNombre = [f.nombre, f.apellido1].filter(Boolean).join(' ').trim() || null;
    if (!fam.guardianIds.includes(f.guardianId)) fam.guardianIds.push(f.guardianId);
    if (!fam.hijosObjetivo.includes(f.studentId)) fam.hijosObjetivo.push(f.studentId);
    porEmail.set(email, fam);
  }
  return {
    familias: [...porEmail.values()].sort((a, b) => a.email.localeCompare(b.email)),
    alumnosConCorreo,
  };
}

/**
 * Completa `hijosTodos` con los hermanos: todos los hijos activos de los tutores de la
 * familia, aunque estén en otra clase o etapa (así un solo enlace le sirve para todo).
 */
export function anadirHermanos(
  familias: FamiliaDestino[],
  hermanos: { guardianId: string; studentId: string }[],
): void {
  const porGuardian = new Map<string, string[]>();
  for (const h of hermanos) {
    const arr = porGuardian.get(h.guardianId) ?? [];
    arr.push(h.studentId);
    porGuardian.set(h.guardianId, arr);
  }
  for (const fam of familias) {
    const set = new Set(fam.hijosObjetivo);
    for (const g of fam.guardianIds) for (const s of porGuardian.get(g) ?? []) set.add(s);
    fam.hijosTodos = [...set];
  }
}

/**
 * Agrupa por correo los tutores de los alumnos pedidos. Devuelve además los alumnos que
 * NO tienen ningún tutor con correo válido: esos no reciben magic link y hay que avisarlos
 * por otra vía (es el dato que más pregunta David antes de un envío masivo).
 */
export async function getFamiliasDeAlumnos(eduStudentIds: string[]): Promise<{
  familias: FamiliaDestino[];
  alumnosSinCorreo: string[];
}> {
  if (eduStudentIds.length === 0) return { familias: [], alumnosSinCorreo: [] };

  const filas = await db
    .select({
      studentId: eduStudentGuardians.studentId,
      orden: eduStudentGuardians.orden,
      guardianId: eduGuardians.id,
      nombre: eduGuardians.nombre,
      apellido1: eduGuardians.apellido1,
      email: eduGuardians.email,
      emailGoogle: eduGuardians.emailGoogle,
    })
    .from(eduStudentGuardians)
    .innerJoin(eduGuardians, eq(eduStudentGuardians.guardianId, eduGuardians.id))
    .where(inArray(eduStudentGuardians.studentId, eduStudentIds));

  const { familias, alumnosConCorreo } = agruparPorCorreo(filas);

  // Hermanos: todos los hijos activos de esos tutores (aunque estén fuera del grupo pedido).
  const guardianIds = [...new Set(familias.flatMap((f) => f.guardianIds))];
  if (guardianIds.length > 0) {
    const hermanos = await db
      .select({ guardianId: eduStudentGuardians.guardianId, studentId: eduStudentGuardians.studentId })
      .from(eduStudentGuardians)
      .innerJoin(eduStudents, eq(eduStudentGuardians.studentId, eduStudents.id))
      .where(and(inArray(eduStudentGuardians.guardianId, guardianIds), eq(eduStudents.active, true)));
    anadirHermanos(familias, hermanos);
  }

  return {
    familias,
    alumnosSinCorreo: eduStudentIds.filter((id) => !alumnosConCorreo.has(id)),
  };
}

function estaVigente(t: FamAccessToken, ahora = new Date()): boolean {
  if (t.revokedAt) return false;
  return !t.expiresAt || t.expiresAt > ahora;
}

/** Tokens vigentes de un propósito, indexados por correo (el más reciente si hay varios). */
export async function getTokensVigentes(
  proposito: PropositoToken,
  emails?: string[],
): Promise<Map<string, FamAccessToken>> {
  if (emails && emails.length === 0) return new Map();
  const rows = await db
    .select()
    .from(famAccessTokens)
    .where(
      and(
        eq(famAccessTokens.proposito, proposito),
        isNull(famAccessTokens.revokedAt),
        ...(emails ? [inArray(famAccessTokens.email, emails)] : []),
      ),
    );
  const out = new Map<string, FamAccessToken>();
  for (const t of rows) {
    if (!t.email || !estaVigente(t)) continue;
    const previo = out.get(t.email);
    if (!previo || previo.createdAt < t.createdAt) out.set(t.email, t);
  }
  return out;
}

export interface TokenAsignado {
  token: string;
  nuevo: boolean;
  actualizado: boolean; // se reutilizó pero se le refrescaron los hijos o la caducidad
}

function mismoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Asegura que cada familia tenga token: reutiliza el vigente (refrescando la lista de hijos
 * si ha cambiado) y crea los que falten. Idempotente: llamarlo dos veces no genera enlaces
 * nuevos, así que se puede invocar antes de cada envío sin miedo.
 */
export async function ensureTokens(
  familias: FamiliaDestino[],
  opts: { proposito: PropositoToken; expiresAt?: Date | null },
): Promise<Map<string, TokenAsignado>> {
  const out = new Map<string, TokenAsignado>();
  if (familias.length === 0) return out;

  const vigentes = await getTokensVigentes(
    opts.proposito,
    familias.map((f) => f.email),
  );
  const nuevos: NewFamAccessToken[] = [];

  for (const f of familias) {
    const t = vigentes.get(f.email);
    if (!t) {
      const token = nuevoTokenFamilia();
      nuevos.push({
        token,
        email: f.email,
        studentIds: f.hijosTodos,
        guardianId: f.guardianIds[0] ?? null,
        proposito: opts.proposito,
        expiresAt: opts.expiresAt ?? null,
      });
      out.set(f.email, { token, nuevo: true, actualizado: false });
      continue;
    }
    const mismosHijos = mismoConjunto(t.studentIds ?? [], f.hijosTodos);
    const ampliarCaducidad = !!opts.expiresAt && (!t.expiresAt || t.expiresAt < opts.expiresAt);
    if (!mismosHijos || ampliarCaducidad) {
      await db
        .update(famAccessTokens)
        .set({
          studentIds: f.hijosTodos,
          ...(ampliarCaducidad ? { expiresAt: opts.expiresAt } : {}),
        })
        .where(eq(famAccessTokens.id, t.id));
    }
    out.set(f.email, { token: t.token, nuevo: false, actualizado: !mismosHijos || ampliarCaducidad });
  }

  // Inserts en lotes: Neon HTTP hace un round-trip por query y aquí hablamos de cientos de
  // familias (300 inserts de uno en uno se irían a decenas de segundos).
  for (let i = 0; i < nuevos.length; i += 200) {
    await db.insert(famAccessTokens).values(nuevos.slice(i, i + 200));
  }
  return out;
}

/** Marca los tokens como enviados (última vez que salieron en un correo). */
export async function marcarTokensEnviados(tokens: string[]): Promise<void> {
  for (let i = 0; i < tokens.length; i += 200) {
    const chunk = tokens.slice(i, i + 200);
    if (chunk.length === 0) continue;
    await db.update(famAccessTokens).set({ sentAt: new Date() }).where(inArray(famAccessTokens.token, chunk));
  }
}

/**
 * Revoca tokens (los enlaces ya enviados dejan de funcionar). Sin `emails` revoca todos los
 * del propósito. No borra filas: queda el histórico de usos.
 */
export async function revocarTokens(proposito: PropositoToken, emails?: string[]): Promise<number> {
  const res = await db
    .update(famAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(famAccessTokens.proposito, proposito),
        isNull(famAccessTokens.revokedAt),
        ...(emails && emails.length > 0 ? [inArray(famAccessTokens.email, emails)] : []),
      ),
    )
    .returning({ id: famAccessTokens.id });
  return res.length;
}

/** Cuántos tokens vigentes hay de un propósito y cuántos se han usado ya. */
export async function getTokensResumen(proposito: PropositoToken): Promise<{
  vigentes: number;
  usados: number;
  enviados: number;
}> {
  const [row] = await db
    .select({
      vigentes: sql<number>`count(*)::int`,
      usados: sql<number>`count(${famAccessTokens.usedAt})::int`,
      enviados: sql<number>`count(${famAccessTokens.sentAt})::int`,
    })
    .from(famAccessTokens)
    .where(
      and(
        eq(famAccessTokens.proposito, proposito),
        isNull(famAccessTokens.revokedAt),
        sql`(${famAccessTokens.expiresAt} is null or ${famAccessTokens.expiresAt} > now())`,
      ),
    );
  return { vigentes: row?.vigentes ?? 0, usados: row?.usados ?? 0, enviados: row?.enviados ?? 0 };
}
