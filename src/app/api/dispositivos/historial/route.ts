import { NextResponse } from 'next/server';
import { historial } from '@/lib/dispositivos-server';
import { fallo, guard, idValido, isGuardResponse } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Lo que ha pasado con un alumno (`?alumno=`), un iPad (`?aparato=`) o un profe (`?profe=`). */
export async function GET(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const q = new URL(request.url).searchParams;
  const filtro = {
    alumno: q.get('alumno') ?? undefined,
    aparato: q.get('aparato') ?? undefined,
    profe: q.get('profe') ?? undefined,
  };
  if (Object.values(filtro).some((v) => v !== undefined && !idValido(v))) {
    return NextResponse.json({ error: 'No existe' }, { status: 404 });
  }
  try {
    return NextResponse.json({ lineas: await historial(filtro) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return fallo(error, 'historial');
  }
}
