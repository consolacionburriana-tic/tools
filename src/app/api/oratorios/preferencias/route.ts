import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { prefsCalendarioSchema } from '@/lib/oratorios';
import { guardarPrefsCalendario } from '@/lib/oratorios-server';

// Cómo sale el evento de Google Calendar de lo que lleva quien tiene la sesión abierta:
// invitarse a sí mismo y que Google mande su propio correo al profe. Cada uno las suyas.
export async function PATCH(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = prefsCalendarioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const preferencias = await guardarPrefsCalendario(guard.email, parsed.data);
    return NextResponse.json({ preferencias });
  } catch (error) {
    console.error('Oratorios · preferencias:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
