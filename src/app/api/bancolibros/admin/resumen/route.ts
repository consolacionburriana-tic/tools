import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { cursoEnBanco } from '@/lib/cursos';
import { getResumenClases } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const resumen = (await getResumenClases()).filter((r) => cursoEnBanco(r.curso));
  return NextResponse.json({ resumen });
}
