import { NextResponse } from 'next/server';
import { guardarFoto } from '@/lib/numeros-server';

export const dynamic = 'force-dynamic';

// Foto mensual de Números del cole: la dispara el cron de Vercel el día 1 de cada mes
// (`vercel.json`), autenticado con `CRON_SECRET`. Es idempotente: si ya hay foto mensual de
// este mes, no hace otra. La foto a mano va por `POST /api/numeros/fotos`, con sesión.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const foto = await guardarFoto('mensual', 'cron');
    return NextResponse.json({ ok: true, ...foto });
  } catch (error) {
    console.error('Números · error en la foto mensual:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
