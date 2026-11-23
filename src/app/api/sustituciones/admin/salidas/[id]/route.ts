// Anular una salida: anula también las ausencias de sus acompañantes (avisando a quien ya lo sabía).
import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { anularSalida } from '@/lib/sustituciones-salidas-server';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'No existe' }, { status: 404 });
    return NextResponse.json(await anularSalida(id, await quienDe(user)));
  } catch (e) {
    return respuestaError(e, 'anular la salida');
  }
}
