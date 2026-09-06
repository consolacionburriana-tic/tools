import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getEstadoAutoasm } from '@/lib/autoasm-entregas';

export const dynamic = 'force-dynamic';

// En qué punto está el curso: si se ha subido algo a ASM y qué alumnado ha entrado
// después. Lo usan la portada del módulo y el escritorio para saber si dar la lata.
export async function GET() {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await getEstadoAutoasm());
  } catch (error) {
    console.error('AUTOASM: error leyendo el estado:', error);
    return NextResponse.json({ error: 'Error leyendo el estado' }, { status: 500 });
  }
}
