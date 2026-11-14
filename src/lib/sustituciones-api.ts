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
  console.error(`Sustituciones · ${que}:`, e instanceof Error ? e.message : e);
  return NextResponse.json({ error: `No se pudo ${que}. Inténtalo otra vez.` }, { status: 500 });
}
