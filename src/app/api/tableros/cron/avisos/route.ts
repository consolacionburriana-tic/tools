import { NextResponse } from 'next/server';
import { enviarAvisosVencimiento } from '@/lib/tableros-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Aviso diario de vencimientos de los Tableros: el cron de Vercel lo lanza cada mañana de
// lunes a viernes (`vercel.json`, 06:45 UTC = 8:45 en invierno) con `CRON_SECRET`. Es
// idempotente: cada tarjeta avisa una vez por deadline.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const r = await enviarAvisosVencimiento();
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error('Tableros · cron de avisos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
