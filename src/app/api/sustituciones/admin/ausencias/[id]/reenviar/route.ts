import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { reenviarAvisos } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Reenvía los avisos que fallaron (o todos, con `todos: true`, también al ausente). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { id } = await params;
    const { todos } = z.object({ todos: z.boolean().default(false) }).parse(await request.json().catch(() => ({})));
    return NextResponse.json({ avisos: await reenviarAvisos(id, todos, await quienDe(user)) });
  } catch (e) {
    return respuestaError(e, 'reenviar los avisos');
  }
}
