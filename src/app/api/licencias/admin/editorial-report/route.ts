import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign, getEditorialReport, getPendingTemplateOrderIds } from '@/lib/licencias-server';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  const [{ rows, orderIds }, pendingTemplateIds] = await Promise.all([
    getEditorialReport(campaign.id),
    getPendingTemplateOrderIds(campaign.id),
  ]);
  return NextResponse.json({
    rows,
    pedidosCount: orderIds.length,
    pendingTemplateCount: pendingTemplateIds.length,
  });
}
