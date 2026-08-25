// Duplicar un formulario. Cubre los tres casos reales de un clic:
//   · mismo curso y misma audiencia → clonar para retocar
//   · otro curso académico → las actividades se copian a ese curso (misma serie)
//   · otra audiencia → mismos bloques con el preset de preguntas de esa audiencia
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { duplicarForm } from '@/lib/evaluaciones-server';

const schema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  audiencia: z.enum(['alumnos', 'profesores', 'familias']).optional(),
  titulo: z.string().min(3).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const opts = schema.parse(body ?? {});
    const form = await duplicarForm(id, { ...opts, createdByEmail: guard.email });
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, form }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
