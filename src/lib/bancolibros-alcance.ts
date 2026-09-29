// Alcance del Banco de libros: tutor y profe ven y rellenan (lotes, entregas, valoración)
// **solo las clases de su etapa**; dirección y demás, todo el centro (David, 28-sep-2026).
// Las mismas etapas que en Alumnado (`etapasDeAlcance`), para que no haya dos criterios.
import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { blAsignaciones, blLotes } from '@/db/schema';
import { requireModule, isGuardResponse, type SessionUser } from '@/lib/auth-guards';
import { etapasDeAlcance } from '@/lib/alumnado-server';
import { etapaDeCurso, type Etapa } from '@/lib/cursos';

export interface AccesoBanco {
  user: SessionUser;
  /** `null` = todas las etapas. */
  etapas: Etapa[] | null;
}

export async function requireBanco(): Promise<AccesoBanco | NextResponse> {
  const user = await requireModule('bancolibros');
  if (isGuardResponse(user)) return user;
  return { user, etapas: await etapasDeAlcance(user) };
}

export function cursoEnAlcance(etapas: Etapa[] | null, curso: string | null | undefined): boolean {
  if (etapas === null) return true;
  const etapa = etapaDeCurso(curso);
  return etapa !== null && etapas.includes(etapa);
}

/** ¿Son todas estas asignaciones de clases de su etapa? */
export async function asignacionesEnAlcance(etapas: Etapa[] | null, ids: string[]): Promise<boolean> {
  if (etapas === null || ids.length === 0) return true;
  const filas = await db
    .select({ curso: blLotes.curso })
    .from(blAsignaciones)
    .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
    .where(inArray(blAsignaciones.id, ids));
  return filas.length === new Set(ids).size && filas.every((f) => cursoEnAlcance(etapas, f.curso));
}

export const fueraDeAlcance = () =>
  NextResponse.json({ error: 'Esa clase no es de tu etapa' }, { status: 403 });
