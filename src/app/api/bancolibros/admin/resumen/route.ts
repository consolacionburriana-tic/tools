import { NextResponse } from 'next/server';
import { cursoEnAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { cursoEnBanco } from '@/lib/cursos';
import { getResumenClases } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
  const resumen = (await getResumenClases()).filter((r) => cursoEnBanco(r.curso) && cursoEnAlcance(acceso.etapas, r.curso));
  return NextResponse.json({ resumen });
}
