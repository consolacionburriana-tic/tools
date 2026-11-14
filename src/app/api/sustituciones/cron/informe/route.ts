import { NextResponse } from 'next/server';
import { enviarInformeDelMesPasado } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

// El informe mensual de Sustituciones (docs/32, decisión 12): lo dispara el cron de Vercel el día 1
// (`vercel.json`) con `CRON_SECRET` y resume el mes anterior. Idempotente: `sust_informes` guarda
// el mes; si ya salió, no repite.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await enviarInformeDelMesPasado()) });
  } catch (error) {
    console.error('Sustituciones · informe mensual:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
