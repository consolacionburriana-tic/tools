import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { actualizarActividad } from '@/lib/evaluaciones-server';

const patchSchema = z.object({
  nombre: z.string().min(2).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lugar: z.string().nullable().optional(),
  categoria: z.enum(['pastoral', 'innovacion', 'general', 'otra']).optional(),
  tipo: z.enum(['actividad', 'asignatura', 'general']).optional(),
  objetivo: z.string().nullable().optional(),
  resumen: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  // Nunca se borran: se archivan (dejan de salir en los selectores, los datos siguen).
  archivada: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    await actualizarActividad(id, patchSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
