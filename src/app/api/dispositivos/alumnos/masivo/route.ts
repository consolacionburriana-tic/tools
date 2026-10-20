import { NextResponse } from 'next/server';
import { masivoSchema } from '@/lib/dispositivos';
import { guardarMasivo } from '@/lib/dispositivos-server';
import { fallo, firma, guard, isGuardResponse, leer } from '../../respuesta';

export const dynamic = 'force-dynamic';

/** La misma modalidad a varios alumnos de una vez (el primer volcado de una clase). */
export async function POST(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const input = await leer(request, masivoSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json(await guardarMasivo(input, firma(g)));
  } catch (error) {
    return fallo(error, 'en bloque');
  }
}
