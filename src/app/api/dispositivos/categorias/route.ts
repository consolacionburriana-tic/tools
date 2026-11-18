import { NextResponse } from 'next/server';
import { categoriaSchema } from '@/lib/dispositivos';
import { guardarCategoria } from '@/lib/dispositivos-server';
import { fallo, guard, isGuardResponse, leer } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Una categoría nueva de iPads del cole (TEC, AL…): nombre, prefijo de los códigos y a quién se le dan. */
export async function POST(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const input = await leer(request, categoriaSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json({ categorias: await guardarCategoria(null, input) });
  } catch (error) {
    return fallo(error, 'crear categoría');
  }
}
