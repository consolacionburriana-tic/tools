import { NextResponse } from 'next/server';
import { cursoEnAlcance, fueraDeAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { getPasarLista } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
  const { searchParams } = new URL(request.url);
  const curso = searchParams.get('curso');
  const cod = searchParams.get('cod');
  if (!curso || !cod) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  if (!cursoEnAlcance(acceso.etapas, curso)) return fueraDeAlcance();
  const filas = await getPasarLista(curso, searchParams.get('letra'), cod);
  return NextResponse.json({ filas });
}
