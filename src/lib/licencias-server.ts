import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { licBooks, licCampaigns, licOrderItems, licOrders, licStudents, type LicStudent } from '@/db/schema';
import { type CatalogBook, maskApellidos, maskName, normalize, resolveBilingual } from '@/lib/licencias';

export async function getCurrentCampaign() {
  const [campaign] = await db
    .select()
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);
  return campaign ?? null;
}

// Mapa { baseCurso: [añosNacimiento] } para los botones del formulario
export async function getBirthYearsByCurso(campaignId: string): Promise<Record<string, number[]>> {
  const rows = await db
    .select({ curso: licStudents.curso, year: licStudents.birthYear })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const map: Record<string, Set<number>> = {};
  for (const r of rows) {
    if (r.year == null) continue;
    (map[r.curso] ??= new Set()).add(r.year);
  }
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, [...v].sort((a, b) => b - a)]),
  );
}

export async function identifyStudents(
  campaignId: string,
  baseCurso: string,
  birthYear: number,
  apellidos: string,
) {
  const rows = await db
    .select()
    .from(licStudents)
    .where(
      and(
        eq(licStudents.campaignId, campaignId),
        eq(licStudents.curso, baseCurso),
        eq(licStudents.birthYear, birthYear),
        eq(licStudents.active, true),
      ),
    );
  const q = normalize(apellidos);
  if (q.length < 3) return []; // exigimos algo más que 2 letras

  // Nivel 1 (exigente): el apellido (o alguna de sus palabras) empieza por lo tecleado
  const strict = rows.filter((s) => {
    const na = normalize(s.apellidos);
    return na.startsWith(q) || na.split(' ').some((w) => w.startsWith(q));
  });
  // Nivel 2 (fallback amplio): solo si el exigente no encuentra nada
  const matched = strict.length > 0 ? strict : rows.filter((s) => normalize(s.apellidos).includes(q));

  return matched.slice(0, 8).map((s) => ({
    id: s.id,
    maskedName: maskName(s.nombre),
    apellidos: maskApellidos(s.apellidos, apellidos),
    cursoLabel: s.curso,
  }));
}

export async function getStudentById(id: string): Promise<LicStudent | null> {
  const [s] = await db.select().from(licStudents).where(eq(licStudents.id, id)).limit(1);
  return s ?? null;
}

// Catálogo que ve la familia: BdL -> solo libros fuera del banco; no-BdL -> todos.
// Pares CAS/VAL resueltos por la lengua base del alumno.
export async function getCatalog(student: LicStudent, curso: string): Promise<CatalogBook[]> {
  const rows = await db
    .select()
    .from(licBooks)
    .where(
      and(
        eq(licBooks.campaignId, student.campaignId),
        eq(licBooks.curso, curso),
        eq(licBooks.active, true),
      ),
    );
  const filtered = student.bancoLibros ? rows.filter((b) => !b.bancoLibros) : rows;
  const resolved = resolveBilingual(filtered, student.lenguaBase);
  return resolved
    .map((b) => ({
      cod: b.cod,
      asignatura: b.asignatura ?? '',
      nombreLibro: b.nombreLibro ?? '',
      editorial: b.editorial ?? '',
      precio: b.precio ?? '0',
      bancoLibros: b.bancoLibros,
      lengua: b.lengua,
    }))
    .sort((a, b) => a.asignatura.localeCompare(b.asignatura, 'es'));
}

export async function getOrderForStudent(campaignId: string, studentId: string) {
  const [order] = await db
    .select()
    .from(licOrders)
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.studentId, studentId)))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select({ cod: licOrderItems.bookCod })
    .from(licOrderItems)
    .where(eq(licOrderItems.orderId, order.id));
  return { order, cods: items.map((i) => i.cod) };
}

export interface UpsertResult {
  orderId: string;
  editToken: string;
  total: number;
  itemCount: number;
}

export async function upsertOrder(
  student: LicStudent,
  curso: string,
  email: string,
  cods: string[],
): Promise<UpsertResult> {
  // Validar códigos contra el catálogo real del alumno (precio de confianza desde la BD)
  const catalog = await getCatalog(student, curso);
  const byCod = new Map(catalog.map((b) => [b.cod, b]));
  const valid = cods.filter((c) => byCod.has(c));
  const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
  const totalStr = total.toFixed(2);

  const existing = await getOrderForStudent(student.campaignId, student.id);

  let orderId: string;
  let editToken: string;

  if (existing) {
    orderId = existing.order.id;
    editToken = existing.order.editToken;
    await db
      .update(licOrders)
      .set({ email, curso, totalPrice: totalStr, bancoLibros: student.bancoLibros, updatedAt: new Date(), confirmedAt: new Date() })
      .where(eq(licOrders.id, orderId));
    await db.delete(licOrderItems).where(eq(licOrderItems.orderId, orderId));
  } else {
    editToken = crypto.randomUUID();
    const [created] = await db
      .insert(licOrders)
      .values({
        campaignId: student.campaignId,
        studentId: student.id,
        curso,
        email,
        bancoLibros: student.bancoLibros,
        status: 'confirmado',
        totalPrice: totalStr,
        editToken,
        confirmedAt: new Date(),
      })
      .returning({ id: licOrders.id });
    orderId = created.id;
  }

  if (valid.length > 0) {
    await db.insert(licOrderItems).values(
      valid.map((c) => {
        const b = byCod.get(c)!;
        return {
          orderId,
          bookCod: c,
          asignatura: b.asignatura,
          idiomaResuelto: b.lengua,
          precio: b.precio,
          isBancoLibros: b.bancoLibros,
        };
      }),
    );
  }

  return { orderId, editToken, total, itemCount: valid.length };
}
