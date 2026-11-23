import { NextResponse } from 'next/server';
import { confirmarPorEnlace } from '@/lib/sustituciones-server';
import { avisarConfirmacion } from '@/lib/sustituciones-confirmacion-server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ estado: 'no_encontrada' }, { status: 404 });
  const estado = await confirmarPorEnlace(token);
  // A Jefatura, como respuesta al aviso (si lo tiene activado). No rompe la confirmación si falla.
  if (estado === 'confirmada') await avisarConfirmacion(token);
  return NextResponse.json({ estado }, { status: estado === 'no_encontrada' ? 404 : 200 });
}
