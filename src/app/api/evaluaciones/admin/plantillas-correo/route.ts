// Plantillas de correo guardadas: cualquiera del claustro con acceso al módulo puede
// crearlas, cargarlas y editarlas (mismo patrón que las de Licencias).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { borrarPlantillaCorreo, getPlantillasCorreo, guardarPlantillaCorreo } from '@/lib/evaluaciones-server';

export async function GET() {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  return NextResponse.json({ plantillas: await getPlantillasCorreo() });
}

const schema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(2),
  audiencia: z.enum(['alumnos', 'profesores', 'familias']).default('alumnos'),
  subject: z.string().min(2),
  body: z.string().min(2),
});

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = schema.parse(await request.json());
    const plantilla = await guardarPlantillaCorreo({ ...input, createdByEmail: guard.email });
    return NextResponse.json({ ok: true, plantilla });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const { id } = await request.json();
  if (typeof id !== 'string') return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  await borrarPlantillaCorreo(id);
  return NextResponse.json({ ok: true });
}
