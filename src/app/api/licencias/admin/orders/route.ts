import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { getCurrentCampaign, listOrders } from '@/lib/licencias-server';


export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  const includeArchived = new URL(request.url).searchParams.get('archived') === '1';
  const orders = await listOrders(campaign.id, { includeArchived });
  return NextResponse.json({ orders });
}
