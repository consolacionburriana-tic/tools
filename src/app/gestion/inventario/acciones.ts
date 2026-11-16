'use server';

// Inventario y aulas: las escrituras, como Server Actions (docs/04: se permiten en paneles
// internos nuevos si simplifican; el guard va dentro de cada una). Cada acción valida con Zod,
// escribe, y refresca la pantalla (`refresh()`): la página vuelve a leer `cargarInventario()`.
// Devuelven `{ ok }` o `{ error }` legible en vez de lanzar, para que el toast diga qué pasó.
import { refresh } from 'next/cache';
import type { ZodType } from 'zod';
import { autorDe, getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import {
  antenaSchema,
  arregloSchema,
  aulaSchema,
  avSchema,
  kitSchema,
  mobiliarioSchema,
  modeloSchema,
  normalizarUrl,
  ocupacionSchema,
  recibirSchema,
  recursoSchema,
} from '@/lib/inventario';
import * as srv from '@/lib/inventario-server';

export type Resultado<T = undefined> = { ok: true; dato?: T } | { ok: false; error: string };

async function quien(): Promise<string> {
  const user = await getSessionUser();
  if (!user || !canAccess(user, 'inventario')) throw new srv.ErrorInventario('Sin permiso para Inventario y aulas');
  return autorDe(user);
}

async function hacer<I, T = undefined>(
  schema: ZodType<I> | null,
  entrada: unknown,
  fn: (input: I, por: string) => Promise<T | void>,
): Promise<Resultado<T>> {
  try {
    const por = await quien();
    let input = entrada as I;
    if (schema) {
      const p = schema.safeParse(entrada);
      if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Datos no válidos' };
      input = p.data;
    }
    const dato = await fn(input, por);
    refresh();
    return { ok: true, dato: dato ?? undefined };
  } catch (e) {
    if (e instanceof srv.ErrorInventario) return { ok: false, error: e.message };
    console.error('Inventario:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se ha podido guardar' };
  }
}

const esId = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x);
function exigirId(x: unknown): string {
  if (!esId(x)) throw new srv.ErrorInventario('Falta a qué se refiere');
  return x;
}

// ─── Aulas ───────────────────────────────────────────────────────────────────
export async function guardarAula(input: unknown) {
  return hacer(aulaSchema, input, (i) => srv.guardarAula(i));
}
export async function archivarAula(id: unknown) {
  return hacer(null, id, () => srv.archivarAula(exigirId(id)));
}
export async function guardarAv(input: unknown) {
  return hacer(avSchema, input, (i, por) => srv.guardarAv(i, por));
}
export async function guardarMobiliario(input: unknown) {
  return hacer(mobiliarioSchema, input, (i, por) => srv.guardarMobiliario(i, por));
}
export async function guardarOcupacion(input: unknown) {
  return hacer(ocupacionSchema, input, (i, por) => srv.guardarOcupacion(i, por));
}

// ─── Antenas ─────────────────────────────────────────────────────────────────
export async function guardarAntena(input: unknown) {
  return hacer(antenaSchema, input, (i, por) => srv.guardarAntena(i, por));
}
export async function marcarAntenaRenombrada(id: unknown) {
  return hacer(null, id, (_, por) => srv.antenaRenombrada(exigirId(id), por));
}
export async function quitarAntena(id: unknown) {
  return hacer(null, id, (_, por) => srv.quitarAntena(exigirId(id), por));
}

// ─── Arreglos ────────────────────────────────────────────────────────────────
export async function guardarArreglo(input: unknown) {
  return hacer(arregloSchema, input, (i, por) => srv.guardarArreglo(i, por));
}
export async function marcarArreglo(id: unknown, hecho: boolean) {
  return hacer(null, id, (_, por) => srv.marcarArreglo(exigirId(id), Boolean(hecho), por));
}
export async function borrarArreglo(id: unknown) {
  return hacer(null, id, () => srv.borrarArreglo(exigirId(id)));
}

// ─── Robótica ────────────────────────────────────────────────────────────────
export async function guardarModelo(input: unknown) {
  return hacer(modeloSchema, input, (i) => srv.guardarModelo(i));
}
export async function archivarModelo(id: unknown) {
  return hacer(null, id, () => srv.archivarModelo(exigirId(id)));
}
export async function recibirKits(input: unknown) {
  return hacer<import('@/lib/inventario').RecibirInput, string[]>(recibirSchema, input, (i, por) => srv.recibirKits(i, por));
}
export async function guardarKit(input: unknown) {
  return hacer(kitSchema, input, (i, por) => srv.guardarKit(i, por));
}
export async function moverKits(ids: unknown, aulaId: unknown) {
  return hacer(null, ids, (_, por) => {
    const lista = Array.isArray(ids) ? ids.filter(esId) : [];
    return srv.moverKits(lista, aulaId === null ? null : exigirId(aulaId), por);
  });
}
export async function borrarKit(id: unknown) {
  return hacer(null, id, () => srv.borrarKit(exigirId(id)));
}
export async function guardarRecurso(input: unknown) {
  return hacer(recursoSchema, input, (i, por) => srv.guardarRecurso({ ...i, url: normalizarUrl(i.url) }, por));
}
export async function borrarRecurso(id: unknown) {
  return hacer(null, id, () => srv.borrarRecurso(exigirId(id)));
}
