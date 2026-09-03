import { NextResponse } from 'next/server';
import { format, previousMonday } from 'date-fns';
import { digestYaEnviado, registrarDigest, resumenSemanalPorTutor } from '@/lib/puntualidad-server';
import { enviarResumenSemanal } from '@/lib/puntualidad-email';
import { semanaISO } from '@/lib/puntualidad';
import { hasModule } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

// Resumen semanal a tutores. Lo dispara el cron de Vercel los viernes por la tarde
// (`vercel.json`), autenticado con `CRON_SECRET`; también se puede lanzar a mano desde el
// panel (ahí vale la sesión con el módulo). Solo se manda a quien tiene retrasos esa
// semana: si en tu clase no ha llegado nadie tarde, no recibes correo.
async function autorizado(request: Request): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  const cabecera = request.headers.get('authorization');
  if (secreto && cabecera === `Bearer ${secreto}`) return true;
  return hasModule('puntualidad');
}

async function ejecutar(request: Request) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const forzar = new URL(request.url).searchParams.get('forzar') === '1';
    const hoy = new Date();
    // Semana en curso: del lunes anterior (o hoy si es lunes) hasta hoy.
    const lunes = hoy.getDay() === 1 ? hoy : previousMonday(hoy);
    const desde = format(lunes, 'yyyy-MM-dd');
    const hasta = format(hoy, 'yyyy-MM-dd');
    const semana = semanaISO(lunes);

    if (!forzar && (await digestYaEnviado(semana))) {
      return NextResponse.json({ ok: true, semana, omitido: 'ya enviado' });
    }

    const tutores = await resumenSemanalPorTutor(desde, hasta);
    const enviados = await enviarResumenSemanal(tutores, desde, hasta);
    if (enviados.length > 0) await registrarDigest(semana, enviados);

    return NextResponse.json({ ok: true, semana, desde, hasta, tutores: tutores.length, enviados: enviados.length });
  } catch (error) {
    console.error('Puntualidad · error en el resumen semanal:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
