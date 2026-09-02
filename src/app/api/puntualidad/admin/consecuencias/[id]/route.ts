import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceClases, borrarConsecuencia, listarConsecuencias, updateConsecuencia } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notas: z.string().max(1000).nullable().optional(),
  tipoClave: z.string().min(2).max(40).optional(),
  cumplida: z.boolean().optional(),
  avisadaEducamos: z.boolean().optional(),
});

/** Una consecuencia es tocable si su alumno está en el alcance de quien pide. */
async function visible(guard: { email: string; role: Parameters<typeof alcanceClases>[0]['role'] }, id: string) {
  const clases = await alcanceClases(guard);
  const lista = await listarConsecuencias({ clases });
  return lista.some((c) => c.id === id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    if (!(await visible(guard, id))) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    await updateConsecuencia(id, patchSchema.parse(await request.json()), guard.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    if (!(await visible(guard, id))) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    await borrarConsecuencia(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
