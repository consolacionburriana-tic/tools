import { NextResponse } from 'next/server';
import { isGuardResponse, requireSession } from '@/lib/auth-guards';
import { buscarAlumnos } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

// Buscador de alumnos del formulario. Basta sesión del claustro: registrar un retraso lo
// puede hacer cualquier profe (igual que el formulario del ABC).
export async function GET(request: Request) {
  const guard = await requireSession();
  if (isGuardResponse(guard)) return guard;
  try {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    return NextResponse.json({ alumnos: await buscarAlumnos(q) });
  } catch (error) {
    console.error('Puntualidad · error buscando alumnos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
