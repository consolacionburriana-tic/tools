import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { accionSesionSchema } from '@/lib/oratorios';
import { accionSesion, borrarSesion } from '@/lib/oratorios-server';

// Mover, reprogramar, anular, cambiar profes o notas de UNA sesión.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const parsed = accionSesionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const sesion = await accionSesion(id, parsed.data, { email: guard.email, nombre: guard.nombre });
    if (!sesion) return NextResponse.json({ error: 'No existe' }, { status: 404 });
    return NextResponse.json({ sesion });
  } catch (error) {
    console.error('Oratorios · acción:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}

// Solo borradores: lo confirmado se anula y deja rastro.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  try {
    const ok = await borrarSesion(id);
    if (!ok) return NextResponse.json({ error: 'Solo se borran borradores; lo confirmado se anula' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Oratorios · borrar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido borrar' }, { status: 500 });
  }
}
