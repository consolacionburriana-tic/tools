import { NextResponse } from 'next/server';
import { enviarAvisosDebidos, sincronizarRespuestas } from '@/lib/oratorios-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Avisos programados de Oratorios / Godly Play: el cron de Vercel lo lanza cada mañana
// (`vercel.json`, 06:30 UTC = 8:30 en invierno) con `CRON_SECRET`. Manda los que tocaban hoy
// o antes y no han salido; es idempotente (lo enviado ya no está «programado»). Después lee en
// Calendar las respuestas de los profes (✅ verde = ha dicho que sí).
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const r = await enviarAvisosDebidos();
    // De paso, se lee qué han contestado los profes en Calendar (no debe tumbar el envío).
    const respuestas = await sincronizarRespuestas().catch(() => null);
    return NextResponse.json({ ok: true, enviados: r.sesiones.length, mensaje: r.mensaje, respuestasActualizadas: respuestas?.sesiones.length ?? null });
  } catch (error) {
    console.error('Oratorios · cron de avisos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
