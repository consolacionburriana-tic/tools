import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign, setAjustePedido } from '@/lib/licencias-server';

const isAdmin = () => hasModule('licencias');

const schema = z.object({
  tipo: z.enum(['pago', 'banco']),
  curso: z.string().min(1),
  cod: z.string().min(1),
  /** null = quitar el retoque y volver al número calculado. */
  unidades: z.number().int().min(0).max(9999).nullable(),
  nota: z.string().max(300).nullable().optional(),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  try {
    const { tipo, curso, cod, unidades, nota } = schema.parse(await request.json());
    const user = await getSessionUser();
    await setAjustePedido(campaign.id, tipo, curso, cod, unidades, nota ?? null, user?.email ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
