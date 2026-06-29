import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign, setCampaignStatus } from '@/lib/licencias-server';

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(ADMIN_COOKIE)?.value !== ADMIN_TOKEN) {
    return new Response('No autorizado', { status: 401 });
  }
  const form = await request.formData();
  const status = String(form.get('status') ?? '');
  if (!['draft', 'open', 'closed'].includes(status)) {
    return new Response('Estado no válido', { status: 400 });
  }
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });
  await setCampaignStatus(campaign.id, status);

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/gestion`, { status: 303 });
}
