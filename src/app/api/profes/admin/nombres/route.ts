import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { fijarNombreMostrado } from '@/lib/educamos-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  teacherId: z.string().uuid(),
  /** El "given name". En blanco = se vuelve a lo que diga Educamos. */
  nombreMostrado: z.string().trim().max(120).nullable().default(null),
});

/**
 * Cómo se llama un profe en todas las salidas del centro. Es el único sitio donde se
 * escribe: lo demás (ASM, cuaderno, correos, paneles) lo lee de aquí.
 */
export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { teacherId, nombreMostrado } = cuerpo.parse(await request.json());
    const profe = await fijarNombreMostrado(teacherId, nombreMostrado);
    if (!profe) return NextResponse.json({ error: 'No existe ese profe' }, { status: 404 });
    return NextResponse.json({ ok: true, nombreMostrado: profe.nombreMostrado });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
