// Piezas comunes de los route handlers de Dispositivos 1:1 (no es una ruta: no se llama route.ts).
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { isGuardResponse, requireModule, type SessionUser } from '@/lib/auth-guards';
import { ErrorDispositivos, type Firma } from '@/lib/dispositivos-server';

export { isGuardResponse };

/** Todo el módulo es de quien tiene `dispositivos` (TIC, secretaría y dirección). */
export function guard() {
  return requireModule('dispositivos');
}

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

/** Traduce los errores del módulo a su código; el resto, 500 sin detalles. */
export function fallo(error: unknown, contexto: string): NextResponse {
  if (error instanceof ErrorDispositivos) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`Dispositivos · ${contexto}:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
}
