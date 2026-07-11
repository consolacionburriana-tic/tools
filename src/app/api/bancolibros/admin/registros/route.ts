import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getPasarLista } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const curso = searchParams.get('curso');
  const cod = searchParams.get('cod');
  if (!curso || !cod) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  const filas = await getPasarLista(curso, searchParams.get('letra'), cod);
  return NextResponse.json({ filas });
}
