import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { listarClases } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';

// Las clases de Classroom del último escaneo (las guarda el paso `classroom`).
export async function GET() {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ clases: await listarClases() });
  } catch (error) {
    console.error('Calendarios: error leyendo las clases:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error leyendo las clases' }, { status: 500 });
  }
}
