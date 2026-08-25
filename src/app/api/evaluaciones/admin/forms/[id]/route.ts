import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { actualizarForm, borrarForm } from '@/lib/evaluaciones-server';

const patchSchema = z.object({
  titulo: z.string().min(3).optional(),
  descripcion: z.string().nullable().optional(),
  estado: z.enum(['borrador', 'abierto', 'cerrado']).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  anonimo: z.boolean().optional(),
  identificaAlumno: z.boolean().optional(),
  pedirClase: z.boolean().optional(),
  pedirEtapa: z.boolean().optional(),
  requiereLogin: z.boolean().optional(),
  avisoAnonimato: z.string().nullable().optional(),
  mensajeFinal: z.string().nullable().optional(),
  clases: z.array(z.object({ curso: z.string(), letra: z.string().nullable() })).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    await actualizarForm(id, patchSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const res = await borrarForm(id);
  if (!res.ok) return NextResponse.json({ error: res.motivo }, { status: 409 });
  return NextResponse.json({ ok: true });
}
