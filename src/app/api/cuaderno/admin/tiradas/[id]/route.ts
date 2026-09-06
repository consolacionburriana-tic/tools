import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  cancelarTirada,
  getEventos,
  getItemsDeTirada,
  getProgreso,
  registrarEvento,
  reintentarErrores,
} from '@/lib/cuaderno-server';
import { arrancarWorker } from '@/lib/cuaderno/tirada';

export const dynamic = 'force-dynamic';
// «Seguir ahora» arranca un pase en esta misma invocación (ver `arrancarWorker`).
export const maxDuration = 60;

/** Estado de una tirada: lo que consulta la barra de progreso del panel. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const progreso = await getProgreso(id);
  if (!progreso) return NextResponse.json({ error: 'No existe esa tirada' }, { status: 404 });
  // Si queda trabajo y hace más de dos minutos que no se toca, se le da un toque al worker:
  // así mirar el progreso rescata por sí solo una tirada que se quedó a medias.
  const parada = Date.now() - progreso.tirada.updatedAt.getTime() > 120_000;
  if (parada && progreso.pendientes + progreso.haciendo > 0 && ['pendiente', 'ejecutando'].includes(progreso.tirada.estado)) {
    arrancarWorker(id);
  }
  const [items, eventos] = await Promise.all([getItemsDeTirada(id), getEventos(id)]);
  return NextResponse.json({ ...progreso, items, eventos });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const { accion } = z.object({ accion: z.enum(['cancelar', 'reintentar', 'seguir']) }).parse(await request.json());
    if (accion === 'cancelar') {
      await cancelarTirada(id);
      await registrarEvento({ tiradaId: id, nivel: 'aviso', fase: 'lanzar', mensaje: `Cancelada por ${guard.email}` });
      return NextResponse.json({ ok: true });
    }
    if (accion === 'reintentar') {
      const reencolados = await reintentarErrores(id);
      if (reencolados > 0) {
        await registrarEvento({ tiradaId: id, fase: 'lanzar', mensaje: `${reencolados} documento(s) con error vuelven a la cola` });
        arrancarWorker(id);
      }
      return NextResponse.json({ ok: true, reencolados });
    }
    await registrarEvento({ tiradaId: id, fase: 'lanzar', mensaje: `«Seguir ahora» pulsado por ${guard.email}` });
    arrancarWorker(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
