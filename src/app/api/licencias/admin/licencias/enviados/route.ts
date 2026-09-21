import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { listarEnvios } from '@/lib/licencias-envios-server';

export const dynamic = 'force-dynamic';

/** El registro de lo que ha salido: qué, a quién, cuándo y si falló. */
export async function GET() {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  return NextResponse.json({ envios: await listarEnvios(campaign.id) });
}
