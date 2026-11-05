import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { crearCampania } from '@/lib/licencias-server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(3, 'Ponle un nombre a la campaña').max(80),
  academicYear: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'El curso escolar tiene la forma 2027/2028'),
  promociona: z.boolean(),
  orderDeadline: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// Crea la campaña del curso siguiente. Solo cuando la anterior está cerrada (lo comprueba
// `crearCampania`); nace en borrador, con el alumnado de la central ya dentro y sin libros.
export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const datos = schema.parse(await request.json());
    const resultado = await crearCampania(datos);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error creando la campaña de licencias:', message);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
