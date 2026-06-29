import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { licBooks, licCampaigns, licOrderItems, licOrders, licStudents, type LicStudent } from '@/db/schema';
import {
  type CatalogBook,
  CURSOS_FORM,
  cursoEfectivo,
  isPdcLetra,
  maskApellidos,
  maskName,
  normalize,
  resolveBilingual,
  toPdcCurso,
} from '@/lib/licencias';

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

export interface DashboardStats {
  totalStudents: number;
  conPedido: number;
  sinPedido: number;
  totalLicencias: number;
  ingresos: number;
  porCurso: { curso: string; total: number; conPedido: number; sinPedido: number; ingresos: number }[];
}

export async function getDashboardStats(campaignId: string): Promise<DashboardStats> {
  const students = await db
    .select({ id: licStudents.id, curso: licStudents.curso, letra: licStudents.letra })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const orders = await db
    .select({ studentId: licOrders.studentId, total: licOrders.totalPrice, curso: licOrders.curso })
    .from(licOrders)
    .where(eq(licOrders.campaignId, campaignId));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(licOrderItems)
    .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
    .where(eq(licOrders.campaignId, campaignId));

  const orderByStudent = new Map(orders.map((o) => [o.studentId, o]));
  const ingresos = orders.reduce((s, o) => s + parseFloat(o.total || '0'), 0);

  // Agrupamos por curso "efectivo": el del pedido (que distingue PDC) o el base si no ha pedido.
  // Sembramos todos los cursos del formulario (incl. 3PDC/4PDC) para que siempre salgan como fila.
  const groups = new Map<string, { total: number; conPedido: number; ingresos: number }>();
  for (const c of CURSOS_FORM) groups.set(c.value, { total: 0, conPedido: 0, ingresos: 0 });
  for (const s of students) {
    const ord = orderByStudent.get(s.id);
    // PDC (letra) manda; si no, el curso del pedido; si no, el base
    const eff = isPdcLetra(s.letra) ? toPdcCurso(s.curso) : ord?.curso?.trim() ? ord.curso : s.curso;
    const g = groups.get(eff) ?? { total: 0, conPedido: 0, ingresos: 0 };
    g.total++;
    if (ord) {
      g.conPedido++;
      g.ingresos += parseFloat(ord.total || '0');
    }
    groups.set(eff, g);
  }
  const porCurso = [...groups.entries()]
    .map(([curso, g]) => ({ curso, total: g.total, conPedido: g.conPedido, sinPedido: g.total - g.conPedido, ingresos: g.ingresos }))
    .sort((a, b) => a.curso.localeCompare(b.curso));

  return {
    totalStudents: students.length,
    conPedido: students.filter((s) => orderByStudent.has(s.id)).length,
    sinPedido: students.filter((s) => !orderByStudent.has(s.id)).length,
    totalLicencias: n ?? 0,
    ingresos,
    porCurso,
  };
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
  // Si el alumno es PDC, su curso efectivo manda sobre lo seleccionado
  const cursoFinal = cursoEfectivo(student.curso, student.letra, curso);
  // Validar códigos contra el catálogo real del alumno (precio de confianza desde la BD)
  const catalog = await getCatalog(student, cursoFinal);
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
      .set({ email, curso: cursoFinal, totalPrice: totalStr, bancoLibros: student.bancoLibros, updatedAt: new Date(), confirmedAt: new Date() })
      .where(eq(licOrders.id, orderId));
    await db.delete(licOrderItems).where(eq(licOrderItems.orderId, orderId));
  } else {
    editToken = crypto.randomUUID();
    const [created] = await db
      .insert(licOrders)
      .values({
        campaignId: student.campaignId,
        studentId: student.id,
        curso: cursoFinal,
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
