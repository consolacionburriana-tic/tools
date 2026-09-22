import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { ponerCodigo, quitarCodigo } from '@/lib/licencias-envios-server';

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

/** Poner o corregir a mano el código de una licencia, desde la propia celda de la tabla. */
export async function PUT(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  try {
    const { id, codigo } = z
      .object({ id: z.string().uuid(), codigo: z.string().trim().min(3).max(100) })
      .parse(await request.json());
    const user = await getSessionUser();
    const r = await ponerCodigo(campaign.id, id, codigo, user?.email ?? null);
    return r.ok
      ? NextResponse.json({ ok: true, reenviar: r.reenviar ?? false })
      : NextResponse.json({ error: r.motivo }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
