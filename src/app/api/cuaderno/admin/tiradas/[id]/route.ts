import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { cancelarTirada, getItemsDeTirada, getProgreso, reintentarErrores } from '@/lib/cuaderno-server';
import { despertarWorker } from '@/lib/cuaderno/tirada';

export const dynamic = 'force-dynamic';

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
  if (parada && progreso.pendientes > 0 && ['pendiente', 'ejecutando'].includes(progreso.tirada.estado)) {
    despertarWorker(id);
  }
  return NextResponse.json({ ...progreso, items: await getItemsDeTirada(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const { accion } = z.object({ accion: z.enum(['cancelar', 'reintentar', 'seguir']) }).parse(await request.json());
    if (accion === 'cancelar') {
      await cancelarTirada(id);
      return NextResponse.json({ ok: true });
    }
    if (accion === 'reintentar') {
      const reencolados = await reintentarErrores(id);
      if (reencolados > 0) despertarWorker(id);
      return NextResponse.json({ ok: true, reencolados });
    }
    despertarWorker(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
