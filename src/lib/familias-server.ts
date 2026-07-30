// Identificación de familias contra la BBDD central: DNI/NIE del tutor → sus hijos,
// NIA → alumno directo, token (magic link) → lo que tenga asociado. Los módulos
// públicos (Licencias, Salidas…) SIEMPRE identifican por aquí y solo devuelven
// nombres enmascarados (maskAlumno) — nunca datos completos.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudentGuardians, eduStudents, famAccessTokens, type EduStudent } from '@/db/schema';
import { detectarIdentificador, maskAlumno, type TipoIdentificador } from '@/lib/familias';

export interface FamilyChild {
  eduStudentId: string;
  maskedName: string; // "Fra. M. Luc."
  curso: string | null;
  letra: string | null;
}

export interface FamilyIdentity {
  tipo: TipoIdentificador;
  hijos: FamilyChild[];
}

function toChild(s: Pick<EduStudent, 'id' | 'nombre' | 'apellido1' | 'apellido2' | 'curso' | 'letra'>): FamilyChild {
  return {
    eduStudentId: s.id,
    maskedName: maskAlumno(s.nombre, s.apellido1, s.apellido2),
    curso: s.curso,
    letra: s.letra,
  };
}

/**
 * Hijos activos de los tutores cuyo documento casa con el tecleado. Comparación
 * insensible a separadores, mayúsculas y ceros a la izquierda (en la BBDD real
 * conviven DNI, NIE, pasaportes y valores con relleno de ceros).
 */
async function hijosPorDocumento(valorNormalizado: string): Promise<FamilyChild[]> {
  const sinCeros = valorNormalizado.replace(/^0+/, '');
  if (sinCeros.length < 5) return [];
  const guardians = await db.execute<{ id: string }>(sql`
    SELECT id FROM edu_guardians
    WHERE ltrim(regexp_replace(upper(dni), '[^A-Z0-9]', '', 'g'), '0') = ${sinCeros}
  `);
  const ids = guardians.rows.map((g) => g.id);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ s: eduStudents })
    .from(eduStudentGuardians)
    .innerJoin(eduStudents, eq(eduStudentGuardians.studentId, eduStudents.id))
    .where(and(inArray(eduStudentGuardians.guardianId, ids), eq(eduStudents.active, true)));
  const unicos = new Map(rows.map((r) => [r.s.id, r.s]));
  return [...unicos.values()].map(toChild);
}

async function hijosPorIds(ids: string[]): Promise<FamilyChild[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(eduStudents)
    .where(and(inArray(eduStudents.id, ids), eq(eduStudents.active, true)));
  return rows.map(toChild);
}

async function hijosDeGuardian(guardianId: string): Promise<FamilyChild[]> {
  const rows = await db
    .select({ s: eduStudents })
    .from(eduStudentGuardians)
    .innerJoin(eduStudents, eq(eduStudentGuardians.studentId, eduStudents.id))
    .where(and(eq(eduStudentGuardians.guardianId, guardianId), eq(eduStudents.active, true)));
  return rows.map((r) => toChild(r.s));
}

/**
 * Resuelve un identificador tecleado por la familia. Devuelve null si no casa con
 * nada (el mensaje al usuario debe ser genérico: no confirmar si un DNI existe).
 */
export async function identifyFamily(input: string): Promise<FamilyIdentity | null> {
  const ident = detectarIdentificador(input);
  if (!ident) return null;

  if (ident.tipo === 'dni') {
    const hijos = await hijosPorDocumento(ident.valor);
    return hijos.length ? { tipo: 'dni', hijos } : null;
  }

  if (ident.tipo === 'nia') {
    const [s] = await db
      .select()
      .from(eduStudents)
      .where(and(eq(eduStudents.nia, ident.valor), eq(eduStudents.active, true)))
      .limit(1);
    if (s) return { tipo: 'nia', hijos: [toChild(s)] };
    // Fallback: hay tutores con documento solo-dígitos; probamos como documento
    const hijos = await hijosPorDocumento(ident.valor);
    return hijos.length ? { tipo: 'dni', hijos } : null;
  }

  // Token (magic link). Un token vale para cualquier módulo público: `proposito` dice para
  // qué se generó/envió, pero no restringe (la familia es la misma en Licencias y en Salidas).
  const [t] = await db.select().from(famAccessTokens).where(eq(famAccessTokens.token, ident.valor)).limit(1);
  if (!t) return null;
  if (t.revokedAt) return null;
  if (t.expiresAt && t.expiresAt < new Date()) return null;
  const hijos = t.studentIds?.length
    ? await hijosPorIds(t.studentIds)
    : t.guardianId
      ? await hijosDeGuardian(t.guardianId)
      : t.studentId
        ? await hijosPorIds([t.studentId])
        : [];
  if (hijos.length === 0) return null;
  await marcarUsoToken(t.id);
  return { tipo: 'token', hijos };
}

/**
 * Contador de usos del token (para ver en el panel si las familias entran por el enlace).
 * `usedAt` guarda el primer uso; el token sigue siendo válido (multiuso).
 */
async function marcarUsoToken(id: string): Promise<void> {
  await db
    .update(famAccessTokens)
    .set({
      usedAt: sql`coalesce(${famAccessTokens.usedAt}, now())`,
      lastUsedAt: new Date(),
      useCount: sql`${famAccessTokens.useCount} + 1`,
    })
    .where(eq(famAccessTokens.id, id));
}

/**
 * Revalida que un alumno pertenece a un identificador (para peticiones posteriores
 * de un flujo público sin sesión: nunca fiarse solo del studentId del cliente).
 */
export async function verifyFamilyStudent(input: string, eduStudentId: string): Promise<FamilyChild | null> {
  const identity = await identifyFamily(input);
  return identity?.hijos.find((h) => h.eduStudentId === eduStudentId) ?? null;
}
