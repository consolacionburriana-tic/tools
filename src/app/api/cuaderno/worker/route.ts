import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { tiradasConTrabajo } from '@/lib/cuaderno-server';
import { despertarWorker, procesarTirada } from '@/lib/cuaderno/tirada';

export const dynamic = 'force-dynamic';
// Una tirada de ESO entera son ~125 documentos; el worker hace los que le caben en este
// tiempo y se re-despierta. El cron de `vercel.json` recoge lo que se quede a medias.
export const maxDuration = 300;

const LIMITE_MS = 240_000;

/**
 * Quién puede despertar al worker: el cron de Vercel y el propio worker con `CRON_SECRET`,
 * o una sesión con el módulo (el botón «seguir» del panel).
 */
async function autorizado(request: Request): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') === `Bearer ${secreto}`) return true;
  return hasModule('cuaderno');
}

async function ejecutar(request: Request) {
  if (!(await autorizado(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const pedida = new URL(request.url).searchParams.get('tirada');
    const cola = pedida ? [pedida] : (await tiradasConTrabajo()).map((t) => t.id);
    if (cola.length === 0) return NextResponse.json({ ok: true, sinTrabajo: true });

    // Una tirada por invocación: si quedan más, se despierta otra vez. Así una tirada larga
    // no bloquea a la siguiente ni se agota el tiempo de la función a medias.
    const resultado = await procesarTirada(cola[0], LIMITE_MS);
    if (!resultado.terminada) despertarWorker(resultado.tiradaId);
    else if (cola.length > 1) despertarWorker(cola[1]);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[cuaderno] worker:', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
