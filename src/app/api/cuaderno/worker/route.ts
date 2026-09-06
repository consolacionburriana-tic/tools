import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import {
  registrarEvento,
  rescatarItemsColgados,
  tiradasColgadas,
  tiradasConTrabajo,
} from '@/lib/cuaderno-server';
import { LIMITE_PASE_MS, pedirOtraVuelta, procesarTirada } from '@/lib/cuaderno/tirada';

export const dynamic = 'force-dynamic';
// 60 s es el techo del plan Hobby de Vercel, así que el worker se ajusta a eso: hace los
// documentos que le caben (del orden de 10-15) y pide otra vuelta hasta acabar la cola. Una
// tirada de ESO entera (~125 documentos) son unas diez vueltas, unos pocos minutos en total.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quién puede hacer trabajar al worker:
 *
 *  1. el cron de Vercel (cabecera `x-vercel-cron`) o cualquiera con `CRON_SECRET`;
 *  2. una sesión con el módulo (el botón «Seguir ahora» del panel);
 *  3. una petición que trae el id de UNA tirada concreta.
 *
 * El caso 3 es el que hace que esto funcione sin configurar nada: el id es un UUID que solo
 * conoce quien ya tiene acceso al módulo, no se devuelve ningún dato con él y lo único que
 * consigue es que se haga el trabajo que su dueño ya había encolado. Antes no existía, la
 * app se llamaba a sí misma sin cookie y el worker contestaba 401 a su propio aviso: dos
 * tiradas se quedaron en «pendiente» sin arrancar nunca.
 */
async function autorizado(request: Request, tirada: string | null): Promise<'pleno' | 'tirada' | null> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') === `Bearer ${secreto}`) return 'pleno';
  if (request.headers.get('x-vercel-cron')) return 'pleno';
  if (await hasModule('cuaderno')) return 'pleno';
  if (tirada && UUID.test(tirada)) return 'tirada';
  return null;
}

async function ejecutar(request: Request) {
  const pedida = new URL(request.url).searchParams.get('tirada');
  const permiso = await autorizado(request, pedida);
  if (!permiso) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    let cola: string[];
    if (pedida) {
      cola = [pedida];
    } else {
      // Pase del cron: además de lo que tiene cola, rescata las tiradas que se quedaron
      // sin nadie que las empujara (todos sus ítems en `haciendo` de un pase que se cortó).
      for (const colgada of await tiradasColgadas()) await rescatarItemsColgados(colgada.id);
      cola = (await tiradasConTrabajo()).map((t) => t.id);
    }
    if (cola.length === 0) return NextResponse.json({ ok: true, sinTrabajo: true });

    // Una tirada por invocación: si quedan más, se pide otra vuelta. Así una tirada larga
    // no bloquea a la siguiente ni se agota el tiempo de la función a medias.
    const resultado = await procesarTirada(cola[0], LIMITE_PASE_MS);
    if (!resultado.terminada) await pedirOtraVuelta(resultado.tiradaId);
    else if (cola.length > 1) await pedirOtraVuelta(cola[1]);
    // Con permiso de solo-tirada no se devuelve el detalle, solo que se hizo el trabajo.
    return permiso === 'pleno' ? NextResponse.json({ ok: true, ...resultado }) : NextResponse.json({ ok: true });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    if (pedida) {
      await registrarEvento({ tiradaId: pedida, nivel: 'error', fase: 'worker', mensaje: `El worker falló: ${mensaje}` });
    } else {
      console.error('[cuaderno] worker:', mensaje);
    }
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
