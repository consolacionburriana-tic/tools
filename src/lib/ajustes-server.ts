// Lectura y escritura de `cfg_ajustes`. Cada clave es un bloque de ajustes (hoy solo `ia`).
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cfgAjustes } from '@/db/schema';
import { leerAjustesIA, type AjustesIA } from '@/lib/ajustes';

async function leer(clave: string): Promise<{ valor: unknown; updatedAt: Date; updatedByEmail: string | null } | null> {
  const [fila] = await db.select().from(cfgAjustes).where(eq(cfgAjustes.clave, clave));
  return fila ?? null;
}

async function guardar(clave: string, valor: unknown, email: string | null): Promise<void> {
  await db
    .insert(cfgAjustes)
    .values({ clave, valor, updatedByEmail: email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor, updatedByEmail: email, updatedAt: new Date() } });
}

export async function getAjustesIA(): Promise<AjustesIA & { updatedAt: Date | null; updatedByEmail: string | null }> {
  const fila = await leer('ia');
  return { ...leerAjustesIA(fila?.valor), updatedAt: fila?.updatedAt ?? null, updatedByEmail: fila?.updatedByEmail ?? null };
}

export async function guardarAjustesIA(ajustes: AjustesIA, email: string | null): Promise<void> {
  await guardar('ia', ajustes, email);
}

/**
 * ¿Hay clave de la API de Anthropic? Es una variable de entorno (secreto): la pantalla solo
 * dice si está o no, nunca la enseña ni la guarda en la BBDD.
 */
export function hayClaveIA(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}
