import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { arrancarEnvio, enviosParados } from '@/lib/evaluaciones-envios-server';

export const dynamic = 'force-dynamic';
// Mismo techo que el resto de workers (plan Hobby de Vercel): cada invocación manda unos 100
// correos por Gmail y pide otra vuelta hasta acabar la cola. Trabaja en `after()`, así que esta
// función contesta al momento y quien la llama no espera.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quién puede empujar un envío: el cron de Vercel o quien tenga `CRON_SECRET`; una sesión con
 * el módulo; o una petición con el id de UN envío concreto (el aviso entre vueltas, que no lleva
 * cookie). El id es un UUID que solo conoce quien ya tiene acceso al módulo, no devuelve datos
 * y lo único que consigue es que se haga lo que ya estaba encolado.
 */
async function autorizado(request: Request, envio: string | null): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') === `Bearer ${secreto}`) return true;
  if (request.headers.get('x-vercel-cron')) return true;
  if (await hasModule('evaluaciones')) return true;
  return !!envio && UUID.test(envio);
}

async function ejecutar(request: Request) {
  const pedido = new URL(request.url).searchParams.get('envio');
  if (!(await autorizado(request, pedido))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    // Con id, ese envío; sin él (el cron diario), los que se hayan quedado parados.
    const ids = pedido ? [pedido] : await enviosParados();
    if (ids.length === 0) return NextResponse.json({ ok: true, sinTrabajo: true });
    // Uno por invocación: el siguiente entra por la vuelta que pide el pase al terminar.
    arrancarEnvio(ids[0]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[evaluaciones] worker:', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
