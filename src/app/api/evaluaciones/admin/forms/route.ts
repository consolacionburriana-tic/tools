import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearForm } from '@/lib/evaluaciones-server';

const claseSchema = z.object({ curso: z.string(), letra: z.string().nullable() });

const schema = z.object({
  titulo: z.string().min(3),
  audiencia: z.enum(['alumnos', 'profesores', 'familias']),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  descripcion: z.string().nullable().optional(),
  clases: z.array(claseSchema).default([]),
  activityIds: z.array(z.string().uuid()).default([]),
  actividadesNuevas: z
    .array(
      z.object({
        nombre: z.string().min(2),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
        lugar: z.string().nullable().default(null),
        categoria: z.enum(['pastoral', 'innovacion', 'general', 'otra']).default('pastoral'),
        objetivo: z.string().nullable().default(null),
        resumen: z.string().nullable().default(null),
      }),
    )
    .default([]),
  conPreset: z.boolean().default(true),
});

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = schema.parse(await request.json());
    if (input.activityIds.length === 0 && input.actividadesNuevas.length === 0) {
      return NextResponse.json({ error: 'Añade al menos una actividad' }, { status: 400 });
    }
    const form = await crearForm({ ...input, createdByEmail: guard.email });
    return NextResponse.json({ ok: true, form }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
