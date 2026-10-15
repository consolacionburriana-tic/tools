// Analizar los resultados con Claude (con el mismo filtro de etapa/clase que la pantalla).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ErrorIA, generarInsight } from '@/lib/evaluaciones-ia-server';

// Una llamada a Haiku tarda segundos. El SDK corta a los 55 s para devolver un error claro
// antes de que lo haga Vercel (60 s, como el resto de rutas del repo).
export const maxDuration = 60;

const schema = z.object({
  clase: z.string().max(40).nullish(),
  etapa: z.string().max(10).nullish(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const [curso, letra] = (parsed.data.clase ?? '').split('|');
  const filtro = curso ? { curso, letra: letra || null } : parsed.data.etapa ? { etapa: parsed.data.etapa } : null;
  try {
    const insight = await generarInsight(id, filtro, guard.email);
    return NextResponse.json({ ok: true, insight });
  } catch (error) {
    if (error instanceof ErrorIA) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[evaluaciones/insights]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido analizar. Prueba otra vez.' }, { status: 500 });
  }
}
