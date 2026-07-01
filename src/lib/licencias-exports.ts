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
  const bookByCod = new Map(books.map((b) => [b.cod, b]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return { students, books, orders, items, studentById, bookByCod, orderById };
}

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString('es-ES') : '';
}

// Plantillas ENVIAR (una fila por licencia de pago). grupo SI = alumno BdL, NO = no BdL.
export async function getEnviarRows(campaignId: string): Promise<EnviarRow[]> {
  const { items, studentById, bookByCod, orderById } = await loadBase(campaignId);
  const rows: EnviarRow[] = [];
  for (const it of items) {
    const order = orderById.get(it.orderId);
    if (!order) continue;
    const s = studentById.get(order.studentId);
    const b = bookByCod.get(it.bookCod);
    rows.push({
      grupo: order.bancoLibros ? 'SI' : 'NO',
      codAlu: s?.studentCode ?? '',
      codLibro: it.bookCod,
      curso: order.curso ?? s?.curso ?? '',
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

// Licencias GRATIS del Banco de Libros: para cada alumno BdL activo, los libros del banco
// de su curso efectivo (resueltos por idioma). Independiente de si ha hecho pedido.
export async function getGratisRows(campaignId: string): Promise<EnviarRow[]> {
  const { students, books } = await loadBase(campaignId);
  const booksByCurso = new Map<string, typeof books>();
  for (const b of books) {
    if (!b.bancoLibros) continue;
    const arr = booksByCurso.get(b.curso) ?? [];
    arr.push(b);
    booksByCurso.set(b.curso, arr);
  }
  const rows: EnviarRow[] = [];
  for (const s of students) {
    if (!s.active || !s.bancoLibros) continue;
    const curso = cursoEfectivo(s.curso, s.letra);
    const bancoBooks = resolveBilingual(booksByCurso.get(curso) ?? [], s.lenguaBase);
    for (const b of bancoBooks) {
      rows.push({
        grupo: 'SI',
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
      });
    }
  }
  return rows.sort((a, b) => a.curso.localeCompare(b.curso) || a.apellidos.localeCompare(b.apellidos, 'es'));
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
  const { items, bookByCod } = await loadBase(campaignId);
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.bookCod, (counts.get(it.bookCod) ?? 0) + 1);
  return [...counts.entries()]
    .map(([cod, unidades]) => {
      const b = bookByCod.get(cod);
      return {
        cod,
        editorial: b?.editorial ?? '',
        curso: b?.curso ?? '',
        asignatura: b?.asignatura ?? '',
        precio: b?.precio ?? '',
        unidades,
      };
    })
    .sort((a, b) => a.editorial.localeCompare(b.editorial) || a.cod.localeCompare(b.cod));
}
