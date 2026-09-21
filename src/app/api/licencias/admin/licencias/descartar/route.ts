import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { descartarLicencias } from '@/lib/licencias-envios-server';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(2000),
  // null deshace el descarte.
  motivo: z.string().max(200).nullable(),
});

/** «Esta optativa no la cursa»: el hueco deja de contar como falta, sin borrarse. */
export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  try {
    const { ids, motivo } = schema.parse(await request.json());
    const count = await descartarLicencias(campaign.id, ids, motivo);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
