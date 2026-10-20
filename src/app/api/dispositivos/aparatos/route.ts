import { NextResponse } from 'next/server';
import { altaAparatosSchema } from '@/lib/dispositivos';
import { altaAparatos } from '@/lib/dispositivos-server';
import { fallo, firma, guard, isGuardResponse, leer } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Alta de iPads del cole: en serie (`cantidad`) o uno por cada nº de serie pegado. */
export async function POST(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const input = await leer(request, altaAparatosSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json({ aparatos: await altaAparatos(input, firma(g)) });
  } catch (error) {
    return fallo(error, 'alta de iPads');
  }
}
