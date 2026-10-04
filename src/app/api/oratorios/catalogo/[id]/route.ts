import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { borrarSesionCatalogo, ErrorDeEntrada } from '@/lib/oratorios-server';

// Solo se borra una sesión que nadie ha elegido; si no, se archiva (con el POST de `/api/oratorios/catalogo`, `activo: false`).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  try {
    await borrarSesionCatalogo(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorDeEntrada) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Oratorios · borrar sesión del abanico:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido borrar' }, { status: 500 });
  }
}
