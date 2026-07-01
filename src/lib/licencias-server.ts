import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { getBooksFromSheet } from '@/lib/google-sheets';
import {
  licBooks,
  licCampaigns,
  licOrderItems,
  licOrders,
  licPacks,
  licStudents,
  type LicOrder,
  type LicOrderItem,
  type LicPack,
  type LicStudent,
} from '@/db/schema';
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

export async function setCampaignStatus(campaignId: string, status: string) {
  await db.update(licCampaigns).set({ status }).where(eq(licCampaigns.id, campaignId));
}

export async function identifyStudents(
  campaignId: string,
  baseCurso: string,
  apellidos: string,
) {
  const rows = await db
    .select()
    .from(licStudents)
    .where(
      and(
        eq(licStudents.campaignId, campaignId),
        eq(licStudents.curso, baseCurso),
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

// Nota: incluye pedidos archivados a propósito — upsertOrder reutiliza esta función
// para decidir UPDATE vs INSERT (hay un unique constraint por campaña+alumno), y al
// reenviar el formulario un pedido archivado se reactiva (ver upsertOrder).
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
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false)));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(licOrderItems)
    .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false)));

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

// ── Packs / itinerarios ───────────────────────────────────────────────────────
export interface CursoBook {
  cod: string;
  asignatura: string;
  lengua: string | null;
  bancoLibros: boolean;
  precio: string | null;
}

export async function getBooksByCurso(campaignId: string, curso: string): Promise<CursoBook[]> {
  const rows = await db
    .select()
    .from(licBooks)
    .where(and(eq(licBooks.campaignId, campaignId), eq(licBooks.curso, curso), eq(licBooks.active, true)));
  return rows
    .map((b) => ({ cod: b.cod, asignatura: b.asignatura ?? '', lengua: b.lengua, bancoLibros: b.bancoLibros, precio: b.precio }))
    .sort((a, b) => a.asignatura.localeCompare(b.asignatura, 'es'));
}

export async function getPacks(campaignId: string, curso: string): Promise<LicPack[]> {
  return db
    .select()
    .from(licPacks)
    .where(and(eq(licPacks.campaignId, campaignId), eq(licPacks.curso, curso)))
    .orderBy(licPacks.sortOrder);
}

export interface PackInput {
  name: string;
  selectionMode: string;
  bookCods: string[];
}

export async function savePacks(campaignId: string, curso: string, packs: PackInput[]) {
  await db.delete(licPacks).where(and(eq(licPacks.campaignId, campaignId), eq(licPacks.curso, curso)));
  if (packs.length > 0) {
    await db.insert(licPacks).values(
      packs.map((p, i) => ({
        campaignId,
        curso,
        name: p.name,
        selectionMode: p.selectionMode,
        bookCods: p.bookCods,
        sortOrder: i,
      })),
    );
  }
}

export interface MissingStudent {
  apellidos: string;
  nombre: string;
  curso: string;
  letra: string | null;
  email: string | null;
}

export async function getMissingStudents(campaignId: string): Promise<MissingStudent[]> {
  const students = await db
    .select({
      id: licStudents.id,
      apellidos: licStudents.apellidos,
      nombre: licStudents.nombre,
      curso: licStudents.curso,
      letra: licStudents.letra,
      email: licStudents.email,
    })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const orders = await db
    .select({ studentId: licOrders.studentId })
    .from(licOrders)
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false)));
  const withOrder = new Set(orders.map((o) => o.studentId));

  return students
    .filter((s) => !withOrder.has(s.id))
    .map((s) => ({
      apellidos: s.apellidos,
      nombre: s.nombre,
      curso: isPdcLetra(s.letra) ? toPdcCurso(s.curso) : s.curso,
      letra: s.letra,
      email: s.email,
    }))
    .sort((a, b) => a.curso.localeCompare(b.curso) || a.apellidos.localeCompare(b.apellidos, 'es'));
}

export interface Recipient {
  email: string;
  nombre: string;
  apellidos: string;
  curso: string;
}

// Destinatarios para correos masivos: 'faltan' (sin pedido, correo del alumno) o 'tienen' (correo del pedido)
export async function getRecipients(campaignId: string, grupo: 'faltan' | 'tienen'): Promise<Recipient[]> {
  const students = await db
    .select({
      id: licStudents.id,
      apellidos: licStudents.apellidos,
      nombre: licStudents.nombre,
      curso: licStudents.curso,
      letra: licStudents.letra,
      email: licStudents.email,
    })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const orders = await db
    .select({ studentId: licOrders.studentId, email: licOrders.email })
    .from(licOrders)
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false)));
  const orderByStudent = new Map(orders.map((o) => [o.studentId, o]));
  const eff = (s: { curso: string; letra: string | null }) => (isPdcLetra(s.letra) ? toPdcCurso(s.curso) : s.curso);

  const out: Recipient[] = [];
  if (grupo === 'faltan') {
    for (const s of students) {
      if (orderByStudent.has(s.id) || !s.email) continue;
      out.push({ email: s.email, nombre: s.nombre, apellidos: s.apellidos, curso: eff(s) });
    }
  } else {
    for (const s of students) {
      const ord = orderByStudent.get(s.id);
      if (!ord?.email) continue;
      out.push({ email: ord.email, nombre: s.nombre, apellidos: s.apellidos, curso: eff(s) });
    }
  }
  return out;
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
      .set({
        email,
        curso: cursoFinal,
        totalPrice: totalStr,
        bancoLibros: student.bancoLibros,
        updatedAt: new Date(),
        confirmedAt: new Date(),
        archived: false, // reenviar el formulario reactiva un pedido archivado por error
        archivedReason: null,
      })
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

// ── Gestión de pedidos (admin) ─────────────────────────────────────────────────
export interface OrderListItem {
  id: string;
  studentId: string;
  nombre: string;
  apellidos: string;
  curso: string;
  bancoLibros: boolean;
  email: string | null;
  total: string;
  itemCount: number;
  confirmedAt: Date | null;
  editorialProcessedAt: Date | null;
  sentToTemplateAt: Date | null;
  paidAt: Date | null;
  archived: boolean;
  archivedReason: string | null;
}

export async function listOrders(campaignId: string, opts: { includeArchived?: boolean } = {}): Promise<OrderListItem[]> {
  const conditions = [eq(licOrders.campaignId, campaignId)];
  if (!opts.includeArchived) conditions.push(eq(licOrders.archived, false));
  const [orders, students, itemCounts] = await Promise.all([
    db.select().from(licOrders).where(and(...conditions)),
    db.select().from(licStudents).where(eq(licStudents.campaignId, campaignId)),
    db
      .select({ orderId: licOrderItems.orderId, n: sql<number>`count(*)::int` })
      .from(licOrderItems)
      .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
      .where(eq(licOrders.campaignId, campaignId))
      .groupBy(licOrderItems.orderId),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const countByOrder = new Map(itemCounts.map((i) => [i.orderId, i.n]));

  return orders
    .map((o) => {
      const s = studentById.get(o.studentId);
      return {
        id: o.id,
        studentId: o.studentId,
        nombre: s?.nombre ?? '',
        apellidos: s?.apellidos ?? '',
        curso: o.curso ?? s?.curso ?? '',
        bancoLibros: o.bancoLibros,
        email: o.email,
        total: o.totalPrice,
        itemCount: countByOrder.get(o.id) ?? 0,
        confirmedAt: o.confirmedAt,
        editorialProcessedAt: o.editorialProcessedAt,
        sentToTemplateAt: o.sentToTemplateAt,
        paidAt: o.paidAt,
        archived: o.archived,
        archivedReason: o.archivedReason,
      };
    })
    .sort((a, b) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0));
}

export interface OrderDetail {
  order: LicOrder;
  student: LicStudent;
  items: (LicOrderItem & { editorial: string; nombreLibro: string })[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const [order] = await db.select().from(licOrders).where(eq(licOrders.id, orderId)).limit(1);
  if (!order) return null;
  const student = await getStudentById(order.studentId);
  if (!student) return null;
  const [items, books] = await Promise.all([
    db.select().from(licOrderItems).where(eq(licOrderItems.orderId, orderId)),
    db.select().from(licBooks).where(eq(licBooks.campaignId, order.campaignId)),
  ]);
  const bookByCod = new Map(books.map((b) => [b.cod, b]));
  return {
    order,
    student,
    items: items.map((it) => ({
      ...it,
      editorial: bookByCod.get(it.bookCod)?.editorial ?? '',
      nombreLibro: bookByCod.get(it.bookCod)?.nombreLibro ?? '',
    })),
  };
}

// Edición manual desde el panel: reemplaza las licencias del pedido (y opcionalmente el email) y recalcula el total
export async function updateOrderItemsAdmin(orderId: string, cods: string[], email?: string): Promise<void> {
  const [order] = await db.select().from(licOrders).where(eq(licOrders.id, orderId)).limit(1);
  if (!order) throw new Error('Pedido no encontrado');
  const student = await getStudentById(order.studentId);
  if (!student) throw new Error('Alumno no encontrado');
  const curso = order.curso ?? student.curso;
  const catalog = await getCatalog(student, curso);
  const byCod = new Map(catalog.map((b) => [b.cod, b]));
  const valid = cods.filter((c) => byCod.has(c));
  const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);

  await db.delete(licOrderItems).where(eq(licOrderItems.orderId, orderId));
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
  await db
    .update(licOrders)
    .set({ totalPrice: total.toFixed(2), updatedAt: new Date(), ...(email?.trim() ? { email: email.trim() } : {}) })
    .where(eq(licOrders.id, orderId));
}

export async function setOrderArchived(orderId: string, archived: boolean, reason?: string): Promise<void> {
  await db
    .update(licOrders)
    .set({ archived, archivedReason: archived ? (reason ?? null) : null, updatedAt: new Date() })
    .where(eq(licOrders.id, orderId));
}

export async function deleteOrderHard(orderId: string): Promise<void> {
  await db.delete(licOrderItems).where(eq(licOrderItems.orderId, orderId));
  await db.delete(licOrders).where(eq(licOrders.id, orderId));
}

export async function setOrderPaid(orderId: string, paid: boolean): Promise<void> {
  await db
    .update(licOrders)
    .set({ paidAt: paid ? new Date() : null, updatedAt: new Date() })
    .where(eq(licOrders.id, orderId));
}

// ── Informe editoriales (equivalente al script "C" de GAS) ────────────────────
export interface EditorialReportRow {
  cod: string;
  editorial: string;
  isbn: string;
  curso: string;
  asignatura: string;
  nombreLibro: string;
  bancoLibros: boolean;
  precio: string;
  unidades: number;
}

// Pedidos no archivados y aún no marcados como "pedidos a la editorial" (Q del Excel)
export async function getEditorialReport(
  campaignId: string,
): Promise<{ rows: EditorialReportRow[]; orderIds: string[] }> {
  const items = await db
    .select({ orderId: licOrderItems.orderId, bookCod: licOrderItems.bookCod })
    .from(licOrderItems)
    .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
    .where(
      and(
        eq(licOrders.campaignId, campaignId),
        eq(licOrders.archived, false),
        isNull(licOrders.editorialProcessedAt),
      ),
    );

  const orderIds = [...new Set(items.map((i) => i.orderId))];
  if (items.length === 0) return { rows: [], orderIds: [] };

  const books = await db.select().from(licBooks).where(eq(licBooks.campaignId, campaignId));
  const bookByCod = new Map(books.map((b) => [b.cod, b]));

  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.bookCod, (counts.get(it.bookCod) ?? 0) + 1);

  const rows = [...counts.entries()]
    .map(([cod, unidades]) => {
      const b = bookByCod.get(cod);
      return {
        cod,
        editorial: b?.editorial ?? '',
        isbn: b?.isbn ?? '',
        curso: b?.curso ?? '',
        asignatura: b?.asignatura ?? '',
        nombreLibro: b?.nombreLibro ?? '',
        bancoLibros: b?.bancoLibros ?? false,
        precio: b?.precio ?? '',
        unidades,
      };
    })
    .sort((a, b) => a.editorial.localeCompare(b.editorial) || a.cod.localeCompare(b.cod));

  return { rows, orderIds };
}

// Marca los pedidos del informe pendiente como "pedidos a la editorial" (Q)
export async function markEditorialProcessed(orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  await db
    .update(licOrders)
    .set({ editorialProcessedAt: new Date(), updatedAt: new Date() })
    .where(inArray(licOrders.id, orderIds));
  return orderIds.length;
}

// Pedidos ya pedidos a la editorial pero aún no pasados a las plantillas de envío (R)
export async function getPendingTemplateOrderIds(campaignId: string): Promise<string[]> {
  const rows = await db
    .select({ id: licOrders.id })
    .from(licOrders)
    .where(
      and(
        eq(licOrders.campaignId, campaignId),
        eq(licOrders.archived, false),
        sql`${licOrders.editorialProcessedAt} is not null`,
        isNull(licOrders.sentToTemplateAt),
      ),
    );
  return rows.map((r) => r.id);
}

export async function markSentToTemplate(orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  await db
    .update(licOrders)
    .set({ sentToTemplateAt: new Date(), updatedAt: new Date() })
    .where(inArray(licOrders.id, orderIds));
  return orderIds.length;
}

// ── Sincronizar catálogo de libros desde la pestaña "BBDD Libros" del Google Sheet ─────
// Upsert por (campaña, curso, código): actualiza si ya existe, inserta si es nuevo.
// Los libros de la campaña que ya no aparecen en el Sheet se desactivan (no se borran,
// para no romper pedidos ya hechos que los referencian).
export async function syncBooksFromSheet(campaignId: string): Promise<{ upserted: number; deactivated: number }> {
  const rows = await getBooksFromSheet();
  if (rows.length === 0) return { upserted: 0, deactivated: 0 };

  for (const r of rows) {
    await db
      .insert(licBooks)
      .values({
        campaignId,
        cod: r.cod,
        editorial: r.editorial || null,
        curso: r.curso,
        lengua: r.lengua || null,
        asignatura: r.asignatura || null,
        nombreLibro: r.nombreLibro || null,
        isbn: r.isbn || null,
        bancoLibros: r.bancoLibros,
        precio: r.precio || null,
        textoFormulario: r.textoFormulario || null,
        active: true,
      })
      .onConflictDoUpdate({
        target: [licBooks.campaignId, licBooks.curso, licBooks.cod],
        set: {
          editorial: r.editorial || null,
          lengua: r.lengua || null,
          asignatura: r.asignatura || null,
          nombreLibro: r.nombreLibro || null,
          isbn: r.isbn || null,
          bancoLibros: r.bancoLibros,
          precio: r.precio || null,
          textoFormulario: r.textoFormulario || null,
          active: true,
        },
      });
  }

  const currentKeys = new Set(rows.map((r) => `${r.curso}::${r.cod}`));
  const existing = await db
    .select({ id: licBooks.id, curso: licBooks.curso, cod: licBooks.cod })
    .from(licBooks)
    .where(and(eq(licBooks.campaignId, campaignId), eq(licBooks.active, true)));
  const toDeactivate = existing.filter((b) => !currentKeys.has(`${b.curso}::${b.cod}`)).map((b) => b.id);
  if (toDeactivate.length > 0) {
    await db.update(licBooks).set({ active: false }).where(inArray(licBooks.id, toDeactivate));
  }

  return { upserted: rows.length, deactivated: toDeactivate.length };
}
