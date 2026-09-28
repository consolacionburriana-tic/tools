import { NextResponse } from 'next/server';
import { cursoEnAlcance, fueraDeAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { getLibrosBanco } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
  const { searchParams } = new URL(request.url);
  const curso = searchParams.get('curso');
  if (!curso) return NextResponse.json({ error: 'Falta curso' }, { status: 400 });
  if (!cursoEnAlcance(acceso.etapas, curso)) return fueraDeAlcance();
  const libros = await getLibrosBanco(curso, searchParams.get('letra'));
  return NextResponse.json({ libros });
}
