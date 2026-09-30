import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { vaciarBorrados } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({ confirmacion: z.literal('VACIAR') });

// Quita de Neon los registros de lo ya borrado (ver `vaciarBorrados`). En Google no toca nada.
export async function POST(request: Request) {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  if (!cuerpo.safeParse(await request.json().catch(() => null)).success) {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json(await vaciarBorrados());
  } catch (error) {
    console.error('Calendarios: error vaciando borrados:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error vaciando el registro' }, { status: 500 });
  }
}
