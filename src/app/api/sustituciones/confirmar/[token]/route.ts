import { NextResponse } from 'next/server';
import { confirmarPorEnlace } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ estado: 'no_encontrada' }, { status: 404 });
  const estado = await confirmarPorEnlace(token);
  return NextResponse.json({ estado }, { status: estado === 'no_encontrada' ? 404 : 200 });
}
