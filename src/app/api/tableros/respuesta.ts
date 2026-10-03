// Piezas comunes de los route handlers de Tableros (no es una ruta: no se llama route.ts).
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { isGuardResponse, requireModule, type SessionUser } from '@/lib/auth-guards';
import { ErrorTableros } from '@/lib/tableros-server';

/** Sesión con el módulo `tableros`, o la respuesta 401/403 lista para devolver. */
export async function guardTableros(): Promise<SessionUser | NextResponse> {
  return requireModule('tableros');
}
export { isGuardResponse };

/** Lee y valida el cuerpo; si no vale, la respuesta 400 con el primer error legible. */
export async function leer<T>(request: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  return parsed.data;
}

/** Traduce los errores del módulo a su código; el resto, 500 sin detalles. */
export function fallo(error: unknown, contexto: string): NextResponse {
  if (error instanceof ErrorTableros) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`Tableros · ${contexto}:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
}
