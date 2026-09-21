import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { quitarCodigo } from '@/lib/licencias-envios-server';

/** Quitar un código mal pegado. Una licencia ya enviada no se toca: el alumno ya lo tiene. */
export async function DELETE(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const ok = await quitarCodigo(campaign.id, id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'No se puede quitar: la licencia ya está enviada' }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
