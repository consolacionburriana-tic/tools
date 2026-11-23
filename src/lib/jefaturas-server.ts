// Quién lleva cada Jefatura de estudios (David, 23-nov-2026: «que se marque que Lucía Vives es Jefa de
// Estudios de Secundaria y José Miguel Batalla de Primaria; se tiene que poder cambiar fácil»). Se
// elige en Ajustes del colegio y se guarda en `cfg_ajustes` (clave `jefaturas`), sin tabla propia.
// Las jefaturas y sus etapas están en `CONFIGURACION.sustituciones.jefaturas`.
import { cookies } from 'next/headers';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers, cfgAjustes } from '@/db/schema';
import { CONFIGURACION } from '@/lib/configuracion';
import { esVistaSemana, etapasDeGrupo, vistaPorDefecto, type VistaSemana } from '@/lib/sustituciones';
import type { Etapa } from '@/lib/cursos';

const CLAVE = 'jefaturas';
export const COOKIE_ETAPAS = 'sust_etapas';
export type ClaveJefatura = (typeof CONFIGURACION.sustituciones.jefaturas)[number]['clave'];
export type Jefaturas = Record<ClaveJefatura, string | null>;

export const esClaveJefatura = (x: unknown): x is ClaveJefatura => CONFIGURACION.sustituciones.jefaturas.some((j) => j.clave === x);

function leer(valor: unknown): Jefaturas {
  const out = Object.fromEntries(CONFIGURACION.sustituciones.jefaturas.map((j) => [j.clave, null])) as Jefaturas;
  if (valor && typeof valor === 'object') {
    for (const j of CONFIGURACION.sustituciones.jefaturas) {
      const v = (valor as Record<string, unknown>)[j.clave];
      if (typeof v === 'string' && v.includes('@')) out[j.clave] = v.trim().toLowerCase();
    }
  }
  return out;
}

export async function getJefaturas(): Promise<Jefaturas & { _meta: { updatedAt: Date | null; updatedByEmail: string | null } }> {
  const [fila] = await db.select().from(cfgAjustes).where(eq(cfgAjustes.clave, CLAVE));
  return { ...leer(fila?.valor), _meta: { updatedAt: fila?.updatedAt ?? null, updatedByEmail: fila?.updatedByEmail ?? null } };
}

export async function guardarJefaturas(j: Partial<Jefaturas>, email: string): Promise<void> {
  const valor = leer(j);
  await db
    .insert(cfgAjustes)
    .values({ clave: CLAVE, valor, updatedByEmail: email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor, updatedByEmail: email, updatedAt: new Date() } });
}

/** La jefatura que lleva alguien (null si ninguna). */
export async function jefaturaDe(email: string): Promise<ClaveJefatura | null> {
  const j = await getJefaturas();
  const e = email.toLowerCase();
  return CONFIGURACION.sustituciones.jefaturas.find((x) => j[x.clave] === e)?.clave ?? null;
}

/** Las jefaturas en las que alguien manda (pueden ser varias: quien lleva las dos). */
export function jefaturasDe(j: Jefaturas, email: string): ClaveJefatura[] {
  const e = email.toLowerCase();
  return CONFIGURACION.sustituciones.jefaturas.filter((x) => j[x.clave] === e).map((x) => x.clave);
}

/** Quién puede llevar una jefatura: el equipo directivo con cuenta activa. */
export async function candidatosJefatura(): Promise<{ email: string; nombre: string }[]> {
  const filas = await db
    .select({ email: authUsers.email, nombre: authUsers.nombre })
    .from(authUsers)
    .where(and(eq(authUsers.active, true), inArray(authUsers.role, [...CONFIGURACION.sustituciones.equipoDirectivoRoles, 'supertic', 'tic'])))
    .orderBy(asc(authUsers.nombre));
  return filas.map((f) => ({ email: f.email.toLowerCase(), nombre: f.nombre ?? f.email }));
}

/**
 * Qué etapas se ven en Sustituciones: lo que la persona eligió (cookie) o, si no eligió, las de su
 * jefatura; quien no lleva ninguna lo ve todo. `'todas'` es ver las dos.
 */
export async function etapasActivas(email: string): Promise<{ grupo: ClaveJefatura | 'todas'; etapas: Etapa[] }> {
  let elegido: string | undefined;
  try {
    elegido = (await cookies()).get(COOKIE_ETAPAS)?.value;
  } catch {
    elegido = undefined;
  }
  if (elegido === 'todas') return { grupo: 'todas', etapas: etapasDeGrupo(null) };
  if (esClaveJefatura(elegido)) return { grupo: elegido, etapas: etapasDeGrupo(elegido) };
  const propia = await jefaturaDe(email);
  return propia ? { grupo: propia, etapas: etapasDeGrupo(propia) } : { grupo: 'todas', etapas: etapasDeGrupo(null) };
}

export const COOKIE_VISTA = 'sust_vista';
export const COOKIE_MODO = 'sust_modo';

/** La vista de la semana: la que se eligió (cookie) o la de su jefatura (Primaria o ESO, en rejilla); si no lleva ninguna, todo el cole. */
export async function vistaActiva(email: string): Promise<{ vista: VistaSemana; modo: 'rejilla' | 'calendario'; propia: ClaveJefatura | null }> {
  let v: string | undefined;
  let m: string | undefined;
  try {
    const c = await cookies();
    v = c.get(COOKIE_VISTA)?.value;
    m = c.get(COOKIE_MODO)?.value;
  } catch {
    v = undefined;
  }
  const propia = await jefaturaDe(email);
  return { vista: esVistaSemana(v) ? v : vistaPorDefecto(propia), modo: m === 'calendario' ? 'calendario' : 'rejilla', propia };
}
