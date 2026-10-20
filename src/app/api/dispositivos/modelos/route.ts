import { NextResponse } from 'next/server';
import { modeloSchema } from '@/lib/dispositivos';
import { guardarModelo } from '@/lib/dispositivos-server';
import { fallo, guard, isGuardResponse, leer } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Un modelo nuevo del catálogo estándar. Devuelve el catálogo entero. */
export async function POST(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const input = await leer(request, modeloSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json({ modelos: await guardarModelo(null, input) });
  } catch (error) {
    return fallo(error, 'nuevo modelo');
  }
}
