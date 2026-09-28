import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { fijarEtapasProfe } from '@/lib/educamos-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  teacherId: z.string().uuid(),
  etapas: z.array(z.enum(['EI', 'EP', 'ESO'])).max(3),
});

/**
 * Las etapas de un profe, en multiselección (hay quien da clase en dos). Deciden qué ve en
 * Alumnado y en el Banco de libros, junto con sus tutorías y su horario.
 */
export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { teacherId, etapas } = cuerpo.parse(await request.json());
    const profe = await fijarEtapasProfe(teacherId, [...new Set(etapas)]);
    if (!profe) return NextResponse.json({ error: 'No existe ese profe' }, { status: 404 });
    return NextResponse.json({ ok: true, etapas: profe.etapas });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
