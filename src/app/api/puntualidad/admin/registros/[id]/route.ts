import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { borrarRegistro, getRegistro, puedeConRegistro, updateRegistro } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  subjectId: z.string().uuid().nullable().optional(),
  justificado: z.boolean().optional(),
  justificacionTipo: z.enum(['familiar', 'medico', 'transporte', 'otro']).nullable().optional(),
  justificacionNota: z.string().max(500).nullable().optional(),
  subeAClase: z.boolean().optional(),
  observaciones: z.string().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const registro = await getRegistro(id);
    if (!registro) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    if (!(await puedeConRegistro(guard, registro))) {
      return NextResponse.json({ error: 'Ese registro no es de tus clases' }, { status: 403 });
    }
    await updateRegistro(id, patchSchema.parse(await request.json()));
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
    const registro = await getRegistro(id);
    if (!registro) return NextResponse.json({ ok: true });
    if (!(await puedeConRegistro(guard, registro))) {
      return NextResponse.json({ error: 'Ese registro no es de tus clases' }, { status: 403 });
    }
    await borrarRegistro(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
