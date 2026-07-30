import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { getBooksFromSheet, type SheetBookRow, type SheetStudentRow } from '@/lib/google-sheets';
import { getStudents as getEduStudents } from '@/lib/educamos-server';
import {
  licBooks,
  licCampaigns,
  licOrderItems,
  licOrders,
  licPacks,
  licStudents,
  type LicBook,
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
  normalize,
  resolveBilingual,
  toPdcCurso,
} from '@/lib/licencias';
import { identifyFamily } from '@/lib/familias-server';
import { getFamiliasDeAlumnos, getTokensVigentes, type FamiliaDestino } from '@/lib/fam-tokens-server';

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

// Identificación por privacidad (2026-07-11): la familia teclea el DNI/NIE del tutor,
// el NIA del alumno o un token de acceso; NUNCA se busca por nombre/apellidos ni se
// devuelven datos sin enmascarar (decisión de protección de datos).
export async function identifyStudentsByFamily(campaignId: string, identificador: string) {
  const identity = await identifyFamily(identificador);
  if (!identity) return [];
  const ids = identity.hijos.map((h) => h.eduStudentId);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(licStudents)
    .where(
      and(
        eq(licStudents.campaignId, campaignId),
        inArray(licStudents.eduStudentId, ids),
        eq(licStudents.active, true),
      ),
    );
  return rows.map((s) => {
    const hijo = identity.hijos.find((h) => h.eduStudentId === s.eduStudentId)!;
    return {
      id: s.id,
      maskedName: hijo.maskedName, // "Fra. M. Luc."
      apellidos: '',
      cursoLabel: s.curso,
    };
  });
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

// ── Destinatarios "por familia" (magic links) ─────────────────────────────────
// El envío clásico (getRecipients) va al correo del ALUMNO, uno por alumno. Este va al
// correo del TUTOR (de la BBDD central), agrupado por correo: una familia con tres hijos
// recibe UN correo con UN enlace que le abre los tres. Ver `fam-tokens-server.ts`.

export interface ClaseLic {
  curso: string;
  letra: string | null;
}

export function claseLicKey(c: { curso: string; letra: string | null }): string {
  return `${c.curso}|${c.letra ?? ''}`;
}

export function claseLicLabel(c: ClaseLic): string {
  return c.letra ? `${c.curso} ${c.letra}` : c.curso;
}

/** Clases reales de la campaña (curso+letra de los alumnos activos), para los filtros. */
export async function getClasesCampaign(campaignId: string): Promise<ClaseLic[]> {
  const rows = await db
    .selectDistinct({ curso: licStudents.curso, letra: licStudents.letra })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  return rows.sort((a, b) => a.curso.localeCompare(b.curso) || (a.letra ?? '').localeCompare(b.letra ?? ''));
}

export interface HijoDeFamilia {
  nombre: string;
  apellido1: string;
  curso: string; // curso efectivo (PDC incluido)
  conPedido: boolean;
}

export interface FamiliaRecipient extends FamiliaDestino {
  /** Hijos de esta familia que entran en la campaña (los que el enlace le deja pedir). */
  hijos: HijoDeFamilia[];
}

export interface FamiliasResumen {
  familias: FamiliaRecipient[];
  alumnosObjetivo: number;
  /** Alumnos del grupo elegido sin ningún tutor con correo: no reciben enlace. */
  alumnosSinCorreo: { nombre: string; apellidos: string; curso: string }[];
  /** Alumnos sin enlace a la BBDD central (no se les puede localizar el tutor). */
  alumnosSinEnlaceCentral: number;
}

/**
 * Familias a las que escribir, filtradas por clases (curso+letra; vacío = toda la campaña)
 * y opcionalmente solo las que tienen algún hijo sin pedido.
 *
 * Los hijos que se listan son TODOS los de la campaña, no solo los de las clases elegidas:
 * el enlace se los abre igual, y así el correo no se contradice con lo que ven al entrar.
 */
export async function getFamiliaRecipients(
  campaignId: string,
  opts: { clases?: ClaseLic[]; soloFaltan?: boolean } = {},
): Promise<FamiliasResumen> {
  const alumnos = await db
    .select({
      id: licStudents.id,
      eduStudentId: licStudents.eduStudentId,
      nombre: licStudents.nombre,
      apellidos: licStudents.apellidos,
      apellido1: licStudents.apellido1,
      curso: licStudents.curso,
      letra: licStudents.letra,
    })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const orders = await db
    .select({ studentId: licOrders.studentId })
    .from(licOrders)
    .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false)));
  const conPedido = new Set(orders.map((o) => o.studentId));

  const conEdu = alumnos.filter((a) => a.eduStudentId);
  const porEdu = new Map(conEdu.map((a) => [a.eduStudentId!, a]));
  const claves = new Set((opts.clases ?? []).map(claseLicKey));
  const objetivo = claves.size > 0 ? conEdu.filter((a) => claves.has(claseLicKey(a))) : conEdu;

  const { familias, alumnosSinCorreo } = await getFamiliasDeAlumnos(objetivo.map((a) => a.eduStudentId!));

  const conHijos: FamiliaRecipient[] = familias
    .map((f) => ({
      ...f,
      hijos: f.hijosTodos
        .map((id) => porEdu.get(id))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({
          nombre: a.nombre,
          apellido1: a.apellido1 ?? a.apellidos,
          curso: isPdcLetra(a.letra) ? toPdcCurso(a.curso) : a.curso,
          conPedido: conPedido.has(a.id),
        }))
        .sort((x, y) => x.curso.localeCompare(y.curso) || x.nombre.localeCompare(y.nombre, 'es')),
    }))
    .filter((f) => f.hijos.length > 0)
    .filter((f) => !opts.soloFaltan || f.hijos.some((h) => !h.conPedido));

  const sinCorreo = alumnosSinCorreo
    .map((id) => porEdu.get(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({
      nombre: a.nombre,
      apellidos: a.apellidos,
      curso: isPdcLetra(a.letra) ? toPdcCurso(a.curso) : a.curso,
    }))
    .sort((x, y) => x.curso.localeCompare(y.curso) || x.apellidos.localeCompare(y.apellidos, 'es'));

  return {
    familias: conHijos,
    alumnosObjetivo: objetivo.length,
    alumnosSinCorreo: sinCorreo,
    alumnosSinEnlaceCentral: alumnos.length - conEdu.length,
  };
}

export interface EstadoAccesos {
  familias: number;
  conEnlace: number;
  usados: number;
  enviados: number;
  alumnosObjetivo: number;
  alumnosSinCorreo: { nombre: string; apellidos: string; curso: string }[];
  alumnosSinEnlaceCentral: number;
}

/** Cobertura de los enlaces de acceso de la campaña (panel de "Enlaces de familias"). */
export async function getEstadoAccesos(campaignId: string): Promise<EstadoAccesos> {
  const resumen = await getFamiliaRecipients(campaignId);
  const tokens = await getTokensVigentes(
    'licencias',
    resumen.familias.map((f) => f.email),
  );
  return {
    familias: resumen.familias.length,
    conEnlace: resumen.familias.filter((f) => tokens.has(f.email)).length,
    usados: resumen.familias.filter((f) => tokens.get(f.email)?.usedAt).length,
    enviados: resumen.familias.filter((f) => tokens.get(f.email)?.sentAt).length,
    alumnosObjetivo: resumen.alumnosObjetivo,
    alumnosSinCorreo: resumen.alumnosSinCorreo,
    alumnosSinEnlaceCentral: resumen.alumnosSinEnlaceCentral,
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
  // El email es opcional: guardamos null (no '') para que los `??` de fallback funcionen aguas abajo
  const cleanEmail = email.trim() || null;
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
        email: cleanEmail,
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
        email: cleanEmail,
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
    .set({ totalPrice: total.toFixed(2), updatedAt: new Date(), ...(email !== undefined ? { email: email.trim() || null } : {}) })
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

// ── Vista previa y aplicación de sincronizaciones desde Google Sheets ──────────────────
// Patrón común: un "plan" (solo lectura, sin escribir en BD) que muestra fila a fila qué
// cambiaría, y una función "apply" separada que hace el upsert real. Apply no reutiliza el
// plan (vuelve a leer el Sheet): así, si el usuario tarda en confirmar y el Sheet cambia
// mientras tanto, se aplica siempre el estado más reciente (comportamiento esperado en un
// botón "sincronizar ahora", no una transacción larga).
export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

function diffFields(pairs: [string, string, string][]): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, before, after] of pairs) {
    if ((before ?? '') !== (after ?? '')) changes.push({ field, before: before || '—', after: after || '—' });
  }
  return changes;
}

// "23.50" vs "23.5" son el mismo precio — comparar como texto daría un falso cambio en
// cada libro cuyo precio termine en 0 (visto en datos reales al probar la sincronización).
function samePrice(a: string, b: string): boolean {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na === nb;
  return a === b;
}

export interface BookPlanItem {
  key: string;
  cod: string;
  curso: string;
  label: string;
  changes: FieldChange[];
}
export interface BookSyncPlan {
  toInsert: BookPlanItem[];
  toUpdate: BookPlanItem[];
  toDeactivate: { key: string; cod: string; curso: string; label: string }[];
  unchanged: number;
}

function bookLabel(r: { editorial: string | null; asignatura: string | null; curso: string }) {
  return `${r.editorial || 'Sin editorial'} · ${r.asignatura || 'Sin asignatura'} (${r.curso})`;
}

function diffBook(r: SheetBookRow, dbRow: LicBook): FieldChange[] {
  const changes = diffFields([
    ['Editorial', dbRow.editorial ?? '', r.editorial],
    ['Lengua', dbRow.lengua ?? '', r.lengua],
    ['Asignatura', dbRow.asignatura ?? '', r.asignatura],
    ['Nombre libro', dbRow.nombreLibro ?? '', r.nombreLibro],
    ['ISBN', dbRow.isbn ?? '', r.isbn],
    ['Banco Libros', dbRow.bancoLibros ? 'Sí' : 'No', r.bancoLibros ? 'Sí' : 'No'],
  ]);
  if (!samePrice(dbRow.precio ?? '', r.precio)) {
    changes.push({ field: 'Precio', before: dbRow.precio || '—', after: r.precio || '—' });
  }
  return changes;
}

// Vista previa: qué cambiaría en lic_books si se sincroniza ahora. No escribe nada.
export async function getBooksSyncPlan(campaignId: string): Promise<BookSyncPlan> {
  const [rows, existing] = await Promise.all([
    getBooksFromSheet(),
    db.select().from(licBooks).where(and(eq(licBooks.campaignId, campaignId), eq(licBooks.active, true))),
  ]);
  const existingByKey = new Map(existing.map((b) => [`${b.curso}::${b.cod}`, b]));
  const sheetKeys = new Set(rows.map((r) => `${r.curso}::${r.cod}`));

  const toInsert: BookPlanItem[] = [];
  const toUpdate: BookPlanItem[] = [];
  let unchanged = 0;
  for (const r of rows) {
    const key = `${r.curso}::${r.cod}`;
    const dbRow = existingByKey.get(key);
    const label = bookLabel(r);
    if (!dbRow) {
      toInsert.push({ key, cod: r.cod, curso: r.curso, label, changes: [] });
    } else {
      const changes = diffBook(r, dbRow);
      if (changes.length > 0) toUpdate.push({ key, cod: r.cod, curso: r.curso, label, changes });
      else unchanged++;
    }
  }
  const toDeactivate = existing
    .filter((b) => !sheetKeys.has(`${b.curso}::${b.cod}`))
    .map((b) => ({ key: `${b.curso}::${b.cod}`, cod: b.cod, curso: b.curso, label: bookLabel(b) }));

  return { toInsert, toUpdate, toDeactivate, unchanged };
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

// ── Alumnos: vista previa y sincronización desde la pestaña "BBDD Alumnos" ─────────────
// La hoja "BBDD Alumnos" contiene TODO el colegio (Infantil a ESO); esta campaña de
// licencias solo cubre los cursos de CURSOS_FORM (6PRI-4ESO/PDC), así que filtramos por
// curso base antes de tocar nada — el resto de filas del Sheet se ignoran (ni se cuentan
// como "a desactivar", porque nunca formaron parte de esta campaña).
const IN_SCOPE_CURSOS = new Set<string>(CURSOS_FORM.map((c) => c.base));

export interface StudentPlanItem {
  key: string;
  studentCode: string;
  label: string;
  changes: FieldChange[];
  warning?: string;
}
export interface StudentSyncPlan {
  toInsert: StudentPlanItem[];
  toUpdate: StudentPlanItem[];
  toDeactivate: { key: string; label: string; hasOrder: boolean }[];
  outOfScope: number;
  unchanged: number;
}

function studentLabel(r: { apellidos: string; nombre: string; curso: string; letra?: string | null }) {
  return `${r.apellidos}, ${r.nombre} (${r.curso}${r.letra ? ' · ' + r.letra : ''})`;
}

function diffStudent(r: SheetStudentRow, dbRow: LicStudent): FieldChange[] {
  const changes = diffFields([
    ['Curso', dbRow.curso, r.curso],
    ['Letra', dbRow.letra ?? '', r.letra ?? ''],
    ['Apellidos', dbRow.apellidos, r.apellidos],
    ['Apellido 1', dbRow.apellido1 ?? '', r.apellido1 ?? ''],
    ['Apellido 2', dbRow.apellido2 ?? '', r.apellido2 ?? ''],
    ['Nombre', dbRow.nombre, r.nombre],
    ['Año nacimiento', dbRow.birthYear != null ? String(dbRow.birthYear) : '', r.birthYear != null ? String(r.birthYear) : ''],
    ['Email', dbRow.email ?? '', r.email ?? ''],
    ['Banco Libros', dbRow.bancoLibros ? 'Sí' : 'No', r.bancoLibros ? 'Sí' : 'No'],
    ['Lengua base', dbRow.lenguaBase ?? '', r.lenguaBase ?? ''],
  ]);
  // "ID Educamos" no está poblado en el Sheet (comprobado: 0/599 filas lo traen). Si viene
  // vacío no lo tocamos ni lo mostramos como cambio — evita borrar un dato que solo existe en Neon.
  if (r.educamosId && r.educamosId !== (dbRow.educamosId ?? '')) {
    changes.push({ field: 'ID Educamos', before: dbRow.educamosId || '—', after: r.educamosId });
  }
  return changes;
}

// Vista previa: qué cambiaría en lic_students si se sincroniza ahora. No escribe nada.
// Avisa cuando un alumno con pedido ya confirmado cambiaría de curso o Banco de Libros,
// porque eso puede dejar de encajar con las licencias que la familia ya eligió.

// ─── Alumnado desde la BBDD central (edu_students) ───────────────────────────
// Licencias vive de la BBDD central: el "sync de alumnos" puebla el snapshot de campaña
// (lic_students) desde edu_students, ya no desde el Google Sheet.
type CentralStudentRow = SheetStudentRow & { eduStudentId: string };

const MODELO_TO_LENGUA: Record<string, string> = { PIP: 'CAS', PEV: 'VAL' };

export async function getStudentsFromCentral(): Promise<CentralStudentRow[]> {
  const rows = await getEduStudents();
  return rows
    .filter((r) => r.codigo && r.curso)
    .map((r) => ({
      eduStudentId: r.id,
      studentCode: r.codigo!,
      educamosId: r.educamosPersonaId,
      curso: r.curso!,
      letra: r.letra,
      birthYear: r.fechaNacimiento ? Number(r.fechaNacimiento.slice(0, 4)) : null,
      apellidos: [r.apellido1, r.apellido2].filter(Boolean).join(' '),
      apellido1: r.apellido1,
      apellido2: r.apellido2,
      nombre: r.nombre ?? '',
      email: r.email ?? r.emailGoogle,
      bancoLibros: r.bancoLibros,
      lenguaBase: r.modeloLinguistico ? (MODELO_TO_LENGUA[r.modeloLinguistico.toUpperCase()] ?? null) : null,
    }));
}

export async function getStudentsSyncPlan(campaignId: string): Promise<StudentSyncPlan> {
  const [allRows, existing, orders] = await Promise.all([
    getStudentsFromCentral(),
    db.select().from(licStudents).where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true))),
    db
      .select({ studentId: licOrders.studentId })
      .from(licOrders)
      .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false))),
  ]);
  const rows = allRows.filter((r) => IN_SCOPE_CURSOS.has(r.curso));
  const outOfScope = allRows.length - rows.length;

  const studentsWithOrder = new Set(orders.map((o) => o.studentId));
  const existingByCode = new Map(existing.map((s) => [s.studentCode, s]));
  const sheetCodes = new Set(rows.map((r) => r.studentCode));

  const toInsert: StudentPlanItem[] = [];
  const toUpdate: StudentPlanItem[] = [];
  let unchanged = 0;
  for (const r of rows) {
    const dbRow = existingByCode.get(r.studentCode);
    const label = studentLabel(r);
    if (!dbRow) {
      toInsert.push({ key: r.studentCode, studentCode: r.studentCode, label, changes: [] });
      continue;
    }
    const changes = diffStudent(r, dbRow);
    if (changes.length === 0) {
      unchanged++;
      continue;
    }
    let warning: string | undefined;
    if (studentsWithOrder.has(dbRow.id) && changes.some((c) => c.field === 'Curso' || c.field === 'Banco Libros')) {
      warning = 'Ya tiene un pedido confirmado en esta campaña: al cambiar curso/Banco de Libros, las licencias ya elegidas podrían dejar de encajar con su catálogo.';
    }
    toUpdate.push({ key: r.studentCode, studentCode: r.studentCode, label, changes, warning });
  }
  const toDeactivate = existing
    .filter((s) => !sheetCodes.has(s.studentCode))
    .map((s) => ({ key: s.studentCode, label: studentLabel(s), hasOrder: studentsWithOrder.has(s.id) }));

  return { toInsert, toUpdate, toDeactivate, outOfScope, unchanged };
}

// Aplica la sincronización: upsert por (campaña, código) preservando el id del alumno
// (los pedidos referencian ese id) y desactivando — nunca borrando — a quien ya no esté
// en el Sheet, para no romper la referencia de pedidos ya hechos (lic_orders.student_id).
export async function syncStudentsFromSheet(campaignId: string): Promise<{ upserted: number; deactivated: number; outOfScope: number }> {
  const allRows = await getStudentsFromCentral();
  const rows = allRows.filter((r) => IN_SCOPE_CURSOS.has(r.curso));
  if (rows.length === 0) return { upserted: 0, deactivated: 0, outOfScope: allRows.length };

  for (const r of rows) {
    await db
      .insert(licStudents)
      .values({
        campaignId,
        studentCode: r.studentCode,
        eduStudentId: r.eduStudentId,
        educamosId: r.educamosId,
        apellidos: r.apellidos,
        apellido1: r.apellido1,
        apellido2: r.apellido2,
        nombre: r.nombre,
        birthYear: r.birthYear,
        curso: r.curso,
        letra: r.letra,
        email: r.email,
        bancoLibros: r.bancoLibros,
        lenguaBase: r.lenguaBase,
        active: true,
      })
      .onConflictDoUpdate({
        target: [licStudents.campaignId, licStudents.studentCode],
        set: {
          // "ID Educamos" no viene poblado en el Sheet: si llega vacío, no lo incluimos en el
          // update para no borrar un valor que solo existe en Neon (ver diffStudent).
          ...(r.educamosId ? { educamosId: r.educamosId } : {}),
          eduStudentId: r.eduStudentId,
          apellidos: r.apellidos,
          apellido1: r.apellido1,
          apellido2: r.apellido2,
          nombre: r.nombre,
          birthYear: r.birthYear,
          curso: r.curso,
          letra: r.letra,
          email: r.email,
          bancoLibros: r.bancoLibros,
          lenguaBase: r.lenguaBase,
          active: true,
        },
      });
  }

  const currentCodes = new Set(rows.map((r) => r.studentCode));
  const existing = await db
    .select({ id: licStudents.id, studentCode: licStudents.studentCode })
    .from(licStudents)
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));
  const toDeactivate = existing.filter((s) => !currentCodes.has(s.studentCode)).map((s) => s.id);
  if (toDeactivate.length > 0) {
    await db.update(licStudents).set({ active: false }).where(inArray(licStudents.id, toDeactivate));
  }

  return { upserted: rows.length, deactivated: toDeactivate.length, outOfScope: allRows.length - rows.length };
}
