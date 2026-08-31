import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { getCurrentCampaign, setCampaignDeadline, setCampaignNoteText, setCampaignStatus } from '@/lib/licencias-server';

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return new Response('No autorizado', { status: 401 });
  }
  const form = await request.formData();
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });

  if (form.has('status')) {
    const status = String(form.get('status') ?? '');
    if (!['draft', 'open', 'closed'].includes(status)) {
      return new Response('Estado no válido', { status: 400 });
    }
    await setCampaignStatus(campaign.id, status);
  }

  if (form.has('orderDeadline')) {
    const orderDeadline = String(form.get('orderDeadline') ?? '').trim();
    await setCampaignDeadline(campaign.id, orderDeadline || null);
  }

  if (form.has('noteText')) {
    const noteText = String(form.get('noteText') ?? '').trim();
    await setCampaignNoteText(campaign.id, noteText || null);
  }

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/gestion`, { status: 303 });
}
