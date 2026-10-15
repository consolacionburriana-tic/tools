// Marcar o desmarcar un comentario con estrella en los resultados.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { marcarDestacado } from '@/lib/evaluaciones-server';

const schema = z.object({
  answerId: z.string().uuid(),
  destacar: z.boolean(),
});

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const ok = await marcarDestacado(parsed.data.answerId, parsed.data.destacar, guard.email);
  if (!ok) return NextResponse.json({ error: 'Solo se pueden destacar comentarios escritos' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
