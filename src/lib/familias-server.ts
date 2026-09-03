// Identificación de familias contra la BBDD central: DNI/NIE del tutor → sus hijos,
// NIA → alumno directo, token (magic link) → lo que tenga asociado. Los módulos
// públicos (Licencias, Salidas…) SIEMPRE identifican por aquí y solo devuelven
// nombres enmascarados (maskAlumno) — nunca datos completos.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { eduGuardians, eduStudentGuardians, eduStudents, famAccessTokens, type EduStudent } from '@/db/schema';
import { detectarIdentificador, maskAlumno, normalizarCorreo, type TipoIdentificador } from '@/lib/familias';

export interface FamilyChild {
  eduStudentId: string;
  maskedName: string; // "Fra. M. Luc."
  curso: string | null;
  letra: string | null;
}

export interface FamilyIdentity {
  tipo: TipoIdentificador;
  hijos: FamilyChild[];
  /**
   * Correo de contacto que tenemos de esta familia: el del tutor cuyo documento se
   * tecleó, el del token (magic link) o, si no, el del tutor 1 de sus hijos. Sirve para
   * ahorrarle a la familia teclearlo.
   *
   * **NO SALE NUNCA EN CLARO A UNA PANTALLA PÚBLICA**: quien teclea un DNI no ha probado
   * ser de esa familia, así que al cliente solo va la máscara (`maskEmail`) y el valor
   * real lo resuelve el servidor al guardar el pedido.
   */
  email: string | null;
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
async function hijosPorDocumento(valorNormalizado: string): Promise<{ hijos: FamilyChild[]; email: string | null }> {
  const sinCeros = valorNormalizado.replace(/^0+/, '');
  if (sinCeros.length < 5) return { hijos: [], email: null };
  const guardians = await db.execute<{ id: string; email: string | null; email_google: string | null }>(sql`
    SELECT id, email, email_google FROM edu_guardians
    WHERE ltrim(regexp_replace(upper(dni), '[^A-Z0-9]', '', 'g'), '0') = ${sinCeros}
  `);
  const ids = guardians.rows.map((g) => g.id);
  if (ids.length === 0) return { hijos: [], email: null };
  // El correo preferido es el del tutor que se ha identificado, no el de la familia en
  // general: si teclea su DNI el padre, la confirmación va a su correo.
  const email =
    guardians.rows.map((g) => normalizarCorreo(g.email) ?? normalizarCorreo(g.email_google)).find(Boolean) ?? null;
  const rows = await db
    .select({ s: eduStudents })
    .from(eduStudentGuardians)
    .innerJoin(eduStudents, eq(eduStudentGuardians.studentId, eduStudents.id))
    .where(and(inArray(eduStudentGuardians.guardianId, ids), eq(eduStudents.active, true)));
  const unicos = new Map(rows.map((r) => [r.s.id, r.s]));
  return { hijos: [...unicos.values()].map(toChild), email };
}

/**
 * Alumnos activos cuyo PROPIO documento casa con el tecleado (`edu_students.dni`, que en ESO
 * suele estar puesto). Misma normalización que el del tutor. David, 2026-09-03: que valga
 * "pero no avises, solo si lo ponen pues" — así que no se anuncia en ninguna pantalla, es
 * simplemente una vía más que funciona si la familia la usa.
 */
async function alumnosPorDocumentoPropio(valorNormalizado: string): Promise<FamilyChild[]> {
  const sinCeros = valorNormalizado.replace(/^0+/, '');
  if (sinCeros.length < 5) return [];
  const rows = await db
    .select()
    .from(eduStudents)
    .where(
      and(
        sql`ltrim(regexp_replace(upper(coalesce(${eduStudents.dni}, '')), '[^A-Z0-9]', '', 'g'), '0') = ${sinCeros}`,
        eq(eduStudents.active, true),
      ),
    );
  // Dos personas NO comparten documento: si casa más de un alumno es un error de datos (a
  // 2026-09-03 hay dos casos reales en Neon, uno entre alumnos de familias distintas), y
  // devolverlos sería enseñarle a quien teclea el nombre enmascarado de un hijo ajeno. Ante la
  // duda, no hay match — el tutor siempre puede entrar con su propio documento o con el NIA.
  return rows.length === 1 ? rows.map(toChild) : [];
}

/**
 * Correo de contacto de la familia de unos alumnos: el del tutor 1, con `email_google`
 * como respaldo. Mismo criterio que el de los magic links (`fam-tokens-server.ts`).
 */
async function emailDeAlumnos(studentIds: string[]): Promise<string | null> {
  if (studentIds.length === 0) return null;
  const rows = await db
    .select({ email: eduGuardians.email, emailGoogle: eduGuardians.emailGoogle })
    .from(eduStudentGuardians)
    .innerJoin(eduGuardians, eq(eduStudentGuardians.guardianId, eduGuardians.id))
    .where(inArray(eduStudentGuardians.studentId, studentIds))
    .orderBy(asc(eduStudentGuardians.orden));
  return rows.map((r) => normalizarCorreo(r.email) ?? normalizarCorreo(r.emailGoogle)).find(Boolean) ?? null;
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
    const { hijos, email } = await hijosPorDocumento(ident.valor);
    if (hijos.length) {
      return { tipo: 'dni', hijos, email: email ?? (await emailDeAlumnos(hijos.map((h) => h.eduStudentId))) };
    }
    // Respaldo: el documento del propio alumno (no es de ningún tutor, pero puede ser suyo).
    const propios = await alumnosPorDocumentoPropio(ident.valor);
    if (!propios.length) return null;
    return { tipo: 'dni', hijos: propios, email: await emailDeAlumnos(propios.map((h) => h.eduStudentId)) };
  }

  if (ident.tipo === 'nia') {
    // Comparación normalizada en SQL (solo dígitos, sin ceros a la izquierda), igual que con el
    // documento del tutor: el importador guarda el NIA tal cual viene del Excel, y una celda
    // numérica o un cero de relleno bastaban para que la familia no se encontrara nunca.
    const sinCeros = ident.valor.replace(/^0+/, '');
    const [s] = await db
      .select()
      .from(eduStudents)
      .where(
        and(
          sql`ltrim(regexp_replace(coalesce(${eduStudents.nia}, ''), '[^0-9]', '', 'g'), '0') = ${sinCeros}`,
          eq(eduStudents.active, true),
        ),
      )
      .limit(1);
    if (s) return { tipo: 'nia', hijos: [toChild(s)], email: await emailDeAlumnos([s.id]) };
    // Fallback: hay tutores (y alumnos) con documento solo-dígitos; probamos como documento
    const { hijos, email } = await hijosPorDocumento(ident.valor);
    if (hijos.length) {
      return { tipo: 'dni', hijos, email: email ?? (await emailDeAlumnos(hijos.map((h) => h.eduStudentId))) };
    }
    const propios = await alumnosPorDocumentoPropio(ident.valor);
    if (!propios.length) return null;
    return { tipo: 'dni', hijos: propios, email: await emailDeAlumnos(propios.map((h) => h.eduStudentId)) };
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
  // El correo del token es el mejor dato que hay: es la dirección a la que se envió ese
  // mismo enlace, así que es justo la que la familia espera ver.
  const email = normalizarCorreo(t.email) ?? (await emailDeAlumnos(hijos.map((h) => h.eduStudentId)));
  return { tipo: 'token', hijos, email };
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
