import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { licBooks, licOrderItems, licOrders, licStudents } from '@/db/schema';
import { cursoEfectivo, isPdcLetra, resolveBilingual, toPdcCurso } from '@/lib/licencias';

export interface EnviarRow {
  grupo: 'SI' | 'NO';
  codAlu: string;
  codLibro: string;
  curso: string;
  asignatura: string;
  editorial: string;
  plataforma: string;
  nombre: string;
  apellidos: string;
  mail: string;
  isbn: string;
  nombreLibro: string;
  bancoLibros: string;
  precio: string;
  fecha: string;
}

export interface PagoRow {
  codAlu: string;
  educamosId: string;
  curso: string;
  apellidos: string;
  nombre: string;
  numLicencias: number;
  codigos: string;
  total: string;
}

export interface EducamosRow {
  curso: string;
  educamosId: string;
  importe: string;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  return '﻿' + body; // BOM para que Excel respete acentos
}

export interface LibroRow {
  cod: string;
  editorial: string;
  curso: string;
  asignatura: string;
  precio: string;
  unidades: number;
}

async function loadBase(campaignId: string) {
  const [students, books, orders, items] = await Promise.all([
    db.select().from(licStudents).where(eq(licStudents.campaignId, campaignId)),
    db.select().from(licBooks).where(eq(licBooks.campaignId, campaignId)),
    db.select().from(licOrders).where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false))),
    db
      .select({
        orderId: licOrderItems.orderId,
        bookCod: licOrderItems.bookCod,
        precio: licOrderItems.precio,
        activationCode: licOrderItems.activationCode,
      })
      .from(licOrderItems)
      .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
      .where(eq(licOrders.campaignId, campaignId)),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return { students, books, orders, items, studentById, bookAt: indexarLibros(books), orderById };
}

/**
 * Un código de libro NO identifica un libro: la unicidad de `lic_books` es `(curso, cod)`,
 * porque el mismo código se repite en cursos distintos (`3ESO-REL` está en 3ESO y en 3PDC).
 * Indexar solo por `cod` fusionaba los dos cursos en una fila —y con el curso del último que
 * entrara en el mapa—, así que el informe a la editorial pedía 57 de 3PDC en vez de 46 de 3ESO
 * y 11 de 3PDC.
 *
 * Devuelve un buscador por `(curso, cod)` que cae a `cod` suelto cuando el curso no cuadra
 * (pedidos viejos sin curso), donde el riesgo de confusión es el que había antes y nunca peor.
 */
export function indexarLibros<T extends { cod: string; curso: string }>(books: T[]) {
  const porCursoCod = new Map(books.map((b) => [`${b.curso}|${b.cod}`, b]));
  const porCod = new Map<string, T>();
  for (const b of books) if (!porCod.has(b.cod)) porCod.set(b.cod, b);
  return (curso: string | null | undefined, cod: string): T | undefined =>
    porCursoCod.get(`${curso ?? ''}|${cod}`) ?? porCod.get(cod);
}

/** Clave de agrupación de un libro en los informes: su identidad real, curso + código. */
export function claveLibro(curso: string | null | undefined, cod: string): string {
  return `${curso ?? ''}|${cod}`;
}

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString('es-ES') : '';
}

// Plantillas ENVIAR (una fila por licencia de pago). grupo SI = alumno BdL, NO = no BdL.
export async function getEnviarRows(campaignId: string): Promise<EnviarRow[]> {
  const { items, studentById, bookAt, orderById } = await loadBase(campaignId);
  const rows: EnviarRow[] = [];
  for (const it of items) {
    const order = orderById.get(it.orderId);
    if (!order) continue;
    const s = studentById.get(order.studentId);
    const curso = order.curso ?? s?.curso ?? '';
    const b = bookAt(curso, it.bookCod);
    rows.push({
      grupo: order.bancoLibros ? 'SI' : 'NO',
      codAlu: s?.studentCode ?? '',
      codLibro: it.bookCod,
      curso,
      asignatura: b?.asignatura ?? '',
      editorial: b?.editorial ?? '',
      plataforma: b?.plataforma ?? '',
      nombre: s?.nombre ?? '',
      apellidos: s?.apellidos ?? '',
      mail: order.email ?? s?.email ?? '',
      isbn: b?.isbn ?? '',
      nombreLibro: b?.nombreLibro ?? '',
      bancoLibros: b?.bancoLibros ? 'Sí' : 'No',
      precio: it.precio ?? b?.precio ?? '',
      fecha: fmtDate(order.confirmedAt),
    });
  }
  return rows.sort((a, b) => a.curso.localeCompare(b.curso) || a.apellidos.localeCompare(b.apellidos, 'es'));
}

// Censo de licencias GRATIS del Banco de Libros: para cada alumno BdL activo, los libros del
// banco de su curso efectivo (resueltos por idioma). Independiente de si ha hecho pedido: un
// alumno del banco recibe sus libros del banco aunque no entre nunca en el formulario.
//
// Fuente ÚNICA del banco de libros: la usan tanto el CSV "ENVIAR · GRATIS" (una fila por
// alumno y libro, para FormMule) como el informe de editoriales (agrupado por libro, para
// pedirlas). Si se calcularan por separado, los dos números acabarían divergiendo.
export async function getBancoLibrosCenso(campaignId: string) {
  const { students, books } = await loadBase(campaignId);
  const booksByCurso = new Map<string, typeof books>();
  for (const b of books) {
    // `active` importa: un libro que ya no está en el Excel se desactiva en vez de borrarse
    // (para no romper los pedidos que lo referencian), pero pedirlo a la editorial sería tirar
    // el dinero. Sin este filtro se colaban Mates A/B y Valores de 4ESO y Tecnología de 3ESO.
    if (!b.bancoLibros || !b.active) continue;
    const arr = booksByCurso.get(b.curso) ?? [];
    arr.push(b);
    booksByCurso.set(b.curso, arr);
  }
  const censo: { student: (typeof students)[number]; book: (typeof books)[number]; curso: string }[] = [];
  for (const s of students) {
    if (!s.active || !s.bancoLibros) continue;
    const curso = cursoEfectivo(s.curso, s.letra);
    for (const b of resolveBilingual(booksByCurso.get(curso) ?? [], s.lenguaBase)) {
      censo.push({ student: s, book: b, curso });
    }
  }
  return censo;
}

export async function getGratisRows(campaignId: string): Promise<EnviarRow[]> {
  const censo = await getBancoLibrosCenso(campaignId);
  return censo
    .map(({ student: s, book: b, curso }) => ({
      grupo: 'SI' as const,
      codAlu: s.studentCode,
      codLibro: b.cod,
      curso,
      asignatura: b.asignatura ?? '',
      editorial: b.editorial ?? '',
      plataforma: b.plataforma ?? '',
      nombre: s.nombre,
      apellidos: s.apellidos,
      mail: s.email ?? '',
      isbn: b.isbn ?? '',
      nombreLibro: b.nombreLibro ?? '',
      bancoLibros: 'Sí',
      precio: '0',
      fecha: '',
    }))
    .sort((a, b) => a.curso.localeCompare(b.curso) || a.apellidos.localeCompare(b.apellidos, 'es'));
}

export async function getPagosConsolidado(campaignId: string): Promise<PagoRow[]> {
  const { orders, items, studentById } = await loadBase(campaignId);
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }
  return orders
    .map((o) => {
      const s = studentById.get(o.studentId);
      const its = itemsByOrder.get(o.id) ?? [];
      return {
        codAlu: s?.studentCode ?? '',
        educamosId: s?.educamosId ?? '',
        curso: o.curso ?? s?.curso ?? '',
        apellidos: s?.apellidos ?? '',
        nombre: s?.nombre ?? '',
        numLicencias: its.length,
        codigos: its.map((i) => i.bookCod).join(', '),
        total: o.totalPrice ?? '0',
      };
    })
    .filter((r) => r.numLicencias > 0)
    .sort((a, b) => a.curso.localeCompare(b.curso) || a.apellidos.localeCompare(b.apellidos, 'es'));
}

// Educamos: una fila por alumno con pedido → curso, ID Educamos, importe (coma decimal)
export async function getEducamosRows(campaignId: string): Promise<EducamosRow[]> {
  const pagos = await getPagosConsolidado(campaignId);
  return pagos
    .filter((p) => parseFloat(p.total) > 0)
    .map((p) => ({ curso: p.curso, educamosId: p.educamosId, importe: p.total.replace('.', ',') }));
}

export interface SheetSyncRow {
  studentCode: string;
  apellidos: string;
  nombre: string;
  birthYear: number | null;
  curso: string;
  email: string;
  codigos: string[];
  letra: string | null;
  lengua: string | null;
  confirmedAt: Date | null;
}

// Agrupa los pedidos activos (no archivados) por banco de libros, para sincronizar con
// las pestañas "SI/NO BdL - FORM26" del Google Sheet histórico.
export async function getSheetSyncData(campaignId: string): Promise<{ si: SheetSyncRow[]; no: SheetSyncRow[] }> {
  const { orders, items, studentById } = await loadBase(campaignId);
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }
  const si: SheetSyncRow[] = [];
  const no: SheetSyncRow[] = [];
  for (const o of orders) {
    const s = studentById.get(o.studentId);
    if (!s) continue;
    const row: SheetSyncRow = {
      studentCode: s.studentCode,
      apellidos: s.apellidos,
      nombre: s.nombre,
      birthYear: s.birthYear,
      curso: o.curso ?? s.curso,
      email: o.email ?? s.email ?? '',
      codigos: (itemsByOrder.get(o.id) ?? []).map((i) => i.bookCod),
      letra: s.letra,
      lengua: s.lenguaBase,
      confirmedAt: o.confirmedAt,
    };
    (o.bancoLibros ? si : no).push(row);
  }
  return { si, no };
}

export async function getPagosPorLibro(campaignId: string): Promise<LibroRow[]> {
  const { items, studentById, bookAt, orderById } = await loadBase(campaignId);
  // Agrupado por (curso, cod): el mismo código en dos cursos son dos libros distintos.
  const counts = new Map<string, { cod: string; curso: string; unidades: number }>();
  for (const it of items) {
    const order = orderById.get(it.orderId);
    if (!order) continue;
    const curso = order.curso ?? studentById.get(order.studentId)?.curso ?? '';
    const k = claveLibro(curso, it.bookCod);
    const prev = counts.get(k);
    if (prev) prev.unidades += 1;
    else counts.set(k, { cod: it.bookCod, curso, unidades: 1 });
  }
  return [...counts.values()]
    .map(({ cod, curso, unidades }) => {
      const b = bookAt(curso, cod);
      return {
        cod,
        editorial: b?.editorial ?? '',
        curso: b?.curso ?? curso,
        asignatura: b?.asignatura ?? '',
        precio: b?.precio ?? '',
        unidades,
      };
    })
    .sort((a, b) => a.editorial.localeCompare(b.editorial) || a.curso.localeCompare(b.curso) || a.cod.localeCompare(b.cod));
}
