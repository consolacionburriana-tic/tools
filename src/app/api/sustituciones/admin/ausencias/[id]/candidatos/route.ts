import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { respuestaError } from '@/lib/sustituciones-api';
import { propuestaParaAnadir } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Para «Añadir horas» en la ficha: a quién mandar a esas horas nuevas. No escribe. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { id } = await params;
    const { claves } = z.object({ claves: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}#[0-9a-f-]{36}$/)).min(1).max(100) }).parse(await request.json());
    return NextResponse.json({ propuesta: await propuestaParaAnadir(id, claves) });
  } catch (e) {
    return respuestaError(e, 'buscar quién puede cubrir');
  }
}
