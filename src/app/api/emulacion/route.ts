import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolverAcceso } from '@/auth';
import { getSessionReal, getSessionUser } from '@/lib/auth-guards';
import {
  codificarEmulacion,
  COOKIE_EMULACION,
  COOKIE_EMULACION_AVISO,
  DURACION_EMULACION_S,
  puedeEmularUsuarios,
  veredictoEmular,
} from '@/lib/emulacion';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ email: z.string().email().transform((e) => e.trim().toLowerCase()) });

const opciones = (maxAge: number, httpOnly: boolean) => ({
  httpOnly,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

/** Quita las dos cookies de emulación de una respuesta. */
function sinEmulacion<T extends NextResponse>(res: T): T {
  res.cookies.set(COOKIE_EMULACION, '', opciones(0, true));
  res.cookies.set(COOKIE_EMULACION_AVISO, '', opciones(0, false));
  return res;
}

// ¿Se está emulando ahora mismo? Lo pregunta el indicador una vez al cargar la página, para no fiarse
// de una cookie cosmética vieja (p. ej. si se cerró la sesión): si ya no es verdad, limpia las cookies.
export async function GET() {
  const user = await getSessionUser();
  if (!user?.emulando) return sinEmulacion(NextResponse.json({ emulando: false }));
  return NextResponse.json({ emulando: true, nombre: user.nombre ?? user.email, email: user.email });
}

// Empezar a emular. Solo el SuperTIC REAL (la sesión de verdad, no la emulada): por eso se lee con
// getSessionReal. La cookie manda a quién se emula, pero solo se hace caso a ella si quien la presenta
// es ese SuperTIC (ver `emuladoPor` en auth-guards.ts), así que no sirve de nada copiarla.
export async function POST(request: Request) {
  const real = await getSessionReal();
  if (!real) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { email } = bodySchema.parse(await request.json());
    // Antes de tocar la BBDD: quien no es SuperTIC no pasa de aquí.
    if (!puedeEmularUsuarios(real.role)) return NextResponse.json({ error: 'Solo el SuperTIC puede emular usuarios' }, { status: 403 });
    if (email === real.email) return NextResponse.json({ error: 'Ya eres tú' }, { status: 403 });
    const acceso = await resolverAcceso(email);
    const veredicto = veredictoEmular({
      realRole: real.role,
      realEmail: real.email,
      objetivoEmail: email,
      objetivoRole: acceso.role,
    });
    if (!veredicto.ok) return NextResponse.json({ error: veredicto.motivo }, { status: 403 });

    const nombre = acceso.nombre || email;
    const res = NextResponse.json({ ok: true, nombre });
    res.cookies.set(COOKIE_EMULACION, codificarEmulacion(real.email, email), opciones(DURACION_EMULACION_S, true));
    res.cookies.set(COOKIE_EMULACION_AVISO, encodeURIComponent(nombre), opciones(DURACION_EMULACION_S, false));
    // Una línea en el log del servidor: quién emuló a quién y cuándo (sin más datos de la persona).
    console.info(`[emulacion] ${real.email} → ${email}`);
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Correo no válido' }, { status: 400 });
    console.error('Emulación · empezar:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'No se pudo emular' }, { status: 500 });
  }
}

// Salir del modo emulado y volver a ser uno mismo. No hace falta ser SuperTIC: borrar una cookie nunca
// da acceso a nada, y así el botón de salir funciona siempre, también con una sesión rara.
export async function DELETE() {
  console.info('[emulacion] fin');
  return sinEmulacion(NextResponse.json({ ok: true }));
}
