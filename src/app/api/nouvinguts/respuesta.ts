// Piezas comunes de los route handlers de Nouvinguts (no es una ruta: no se llama route.ts).
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { isGuardResponse, requireModule, type SessionUser } from '@/lib/auth-guards';
import { ErrorNouvinguts, fichaNouvingut, type Firma } from '@/lib/nouvinguts-server';

export { isGuardResponse, requireModule };

export function firma(user: SessionUser): Firma {
  return { email: user.email, nombre: user.nombre };
}

export function idValido(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

/** Lee y valida el cuerpo; si no vale, la respuesta 400 con el primer error legible. */
export async function leer<T>(request: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  return parsed.data;
}

/** La ficha tal y como queda, para que la pantalla pinte lo que hay en la BBDD. */
export async function conFicha(id: string, user: SessionUser): Promise<NextResponse> {
  const ficha = await fichaNouvingut(id, user.role);
  if (!ficha) return NextResponse.json({ error: 'Ese nouvingut no existe' }, { status: 404 });
  return NextResponse.json({ ficha });
}

/** Traduce los errores del módulo a su código; el resto, 500 sin detalles. */
export function fallo(error: unknown, contexto: string): NextResponse {
  if (error instanceof ErrorNouvinguts) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`Nouvinguts · ${contexto}:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
}
