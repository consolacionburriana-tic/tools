import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { copiarActividad, crearActividad, getActividades } from '@/lib/evaluaciones-server';

export async function GET(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const url = new URL(request.url);
  const actividades = await getActividades({
    academicYear: url.searchParams.get('anio') ?? undefined,
    categoria: url.searchParams.get('categoria') ?? undefined,
  });
  return NextResponse.json({ actividades });
}

const schema = z.union([
  z.object({
    accion: z.literal('crear'),
    nombre: z.string().min(2),
    academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    lugar: z.string().nullable().default(null),
    categoria: z.enum(['pastoral', 'innovacion', 'general', 'otra']).default('pastoral'),
    tipo: z.enum(['actividad', 'asignatura', 'general']).default('actividad'),
    objetivo: z.string().nullable().default(null),
    resumen: z.string().nullable().default(null),
    notas: z.string().nullable().default(null),
  }),
  // Traer la actividad del curso pasado: se copia manteniendo la serie, que es lo que
  // permite comparar después las dos ediciones.
  z.object({
    accion: z.literal('copiar'),
    id: z.string().uuid(),
    academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  }),
]);

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = schema.parse(await request.json());
    if (input.accion === 'copiar') {
      const actividad = await copiarActividad(input.id, input.academicYear, guard.email);
      if (!actividad) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
      return NextResponse.json({ ok: true, actividad }, { status: 201 });
    }
    // `crearActividad` toma solo los campos que conoce, así que el `accion` sobrante no estorba.
    const actividad = await crearActividad({ ...input, createdByEmail: guard.email });
    return NextResponse.json({ ok: true, actividad }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
