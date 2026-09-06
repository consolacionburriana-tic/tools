import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { fijarNombre } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  ambito: z.enum(['profe', 'alumno', 'familiar']),
  personaId: z.string().uuid(),
  pila: z.string().max(120).nullable().default(null),
  completo: z.string().max(200).nullable().default(null),
});

/**
 * Fija cómo se llama alguien en el cuaderno, cuando lo que trae Educamos no vale. Con los
 * dos campos en blanco se vuelve a lo que diga el export.
 */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    await fijarNombre(cuerpo.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
