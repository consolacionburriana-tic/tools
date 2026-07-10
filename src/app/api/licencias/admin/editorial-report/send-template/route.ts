import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { getCurrentCampaign, getPendingTemplateOrderIds, markSentToTemplate } from '@/lib/licencias-server';


// Marca como "pasado a plantillas de envío" (📤) los pedidos ya pedidos a la editorial
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  const pendingIds = await getPendingTemplateOrderIds(campaign.id);
  const count = await markSentToTemplate(pendingIds);
  return NextResponse.json({ ok: true, count });
}
