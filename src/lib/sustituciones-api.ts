// Lo común de las rutas de Sustituciones: de quién es la petición y cómo se contesta un error.
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { autorDe, type SessionUser } from '@/lib/auth-guards';
import { ErrorSustitucion, nombreDe, type Quien } from '@/lib/sustituciones-server';

/** Quien firma y manda los correos: la persona real, también si un SuperTIC está emulando. */
export async function quienDe(user: SessionUser): Promise<Quien> {
  if (user.emulando) return { email: user.emulando.email, nombre: user.emulando.nombre ?? (await nombreDe(user.emulando.email)), emulando: true, firma: autorDe(user) };
  return { email: user.email, nombre: user.nombre ?? (await nombreDe(user.email)), firma: user.email };
}

/** Un error a la pantalla: lo que ha mandado mal la persona con su texto; lo demás, al log. */
export function respuestaError(e: unknown, que: string): NextResponse {
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  if (e instanceof ErrorSustitucion) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof SyntaxError) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  console.error(`Sustituciones · ${que}:`, mensajeSeguro(e));
  return NextResponse.json({ error: `No se pudo ${que}. Inténtalo otra vez.` }, { status: 500 });
}

/**
 * Qué decir en el log de un error SIN datos: el `message` de un error de Drizzle lleva la consulta y
 * sus parámetros (el motivo de una ausencia, que es un dato de salud). Solo el nombre y el error de
 * Postgres que lo causó.
 */
export function mensajeSeguro(e: unknown): string {
  if (!(e instanceof Error)) return 'error desconocido';
  const causa = (e as { cause?: unknown }).cause;
  if (e.name === 'DrizzleQueryError' || /^Failed query:/.test(e.message)) {
    const c = causa instanceof Error ? causa : null;
    return `${e.name}: ${c ? `${c.name} ${(c as { code?: string }).code ?? ''} ${c.message}`.trim() : 'fallo en la consulta'}`;
  }
  return `${e.name}: ${e.message}`;
}
