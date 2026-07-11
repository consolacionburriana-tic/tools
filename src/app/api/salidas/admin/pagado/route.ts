import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { marcarPagado } from '@/lib/salidas-server';

// Salidas con pago en mano: marcar pagado/no pagado en un toque.
export async function POST(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { tripId, eduStudentId, pagado } = z
      .object({ tripId: z.string().uuid(), eduStudentId: z.string().uuid(), pagado: z.boolean() })
      .parse(await request.json());
    const signupId = await marcarPagado(tripId, eduStudentId, pagado);
    return NextResponse.json({ ok: true, signupId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
