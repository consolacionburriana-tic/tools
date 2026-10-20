import { NextResponse } from 'next/server';
import { estadoAlumnoSchema } from '@/lib/dispositivos';
import { guardarEstadoAlumno } from '@/lib/dispositivos-server';
import { fallo, firma, guard, isGuardResponse, leer } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Cómo tiene el iPad un alumno (`modalidad: null` = vuelve a «sin informar»). */
export async function POST(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const input = await leer(request, estadoAlumnoSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json(await guardarEstadoAlumno(input, firma(g)));
  } catch (error) {
    return fallo(error, 'estado del alumno');
  }
}
