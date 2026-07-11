import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getLibrosBanco } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const curso = searchParams.get('curso');
  if (!curso) return NextResponse.json({ error: 'Falta curso' }, { status: 400 });
  const libros = await getLibrosBanco(curso, searchParams.get('letra'));
  return NextResponse.json({ libros });
}
