import { NextResponse } from 'next/server';
import { mensajeSeguro } from '@/lib/sustituciones-api';
import { procesarAvisosProgramados } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await procesarAvisosProgramados()) });
  } catch (error) {
    console.error('Sustituciones · envíos programados:', mensajeSeguro(error));
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
