import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getAsignacionesHorario } from '@/lib/autoasm-server';

export const dynamic = 'force-dynamic';

// Las asignaciones docentes del periodo en vigor, que son las clases de ASM.
export async function GET() {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await getAsignacionesHorario());
  } catch (error) {
    console.error('AUTOASM: error leyendo el horario:', error);
    return NextResponse.json({ error: 'No se ha podido leer el horario' }, { status: 500 });
  }
}
