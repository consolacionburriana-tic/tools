import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { asignarTutor, quitarTutor } from '@/lib/tutorias-server';

export const dynamic = 'force-dynamic';

const asignarSchema = z.object({
  curso: z.string().min(1),
  letra: z.string().nullable(),
  teacherId: z.string().uuid(),
});

export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { curso, letra, teacherId } = asignarSchema.parse(await request.json());
    const id = await asignarTutor(curso, letra, teacherId);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const quitarSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = quitarSchema.parse(await request.json());
    await quitarTutor(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
