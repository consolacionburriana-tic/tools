import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { sesionCatalogoSchema } from '@/lib/oratorios';
import { ErrorDeEntrada, guardarSesionCatalogo } from '@/lib/oratorios-server';

const cuerpo = z.object({ id: z.string().uuid().nullable(), sesion: sesionCatalogoSchema });

// Crear o editar una sesión del abanico (lo que se hace en el momento): nombre, enlace, curso…
export async function POST(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = cuerpo.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const sesion = await guardarSesionCatalogo(parsed.data.id, parsed.data.sesion, guard.email);
    return NextResponse.json({ sesion });
  } catch (error) {
    if (error instanceof ErrorDeEntrada) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Oratorios · abanico:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
