import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getBooksByCurso, getCurrentCampaign, getPacks, savePacks, type PackInput } from '@/lib/licencias-server';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const curso = new URL(request.url).searchParams.get('curso');
  if (!curso) return NextResponse.json({ error: 'Falta curso' }, { status: 400 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  const [books, packs] = await Promise.all([
    getBooksByCurso(campaign.id, curso),
    getPacks(campaign.id, curso),
  ]);
  return NextResponse.json({ books, packs });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { curso, packs } = (await request.json()) as { curso: string; packs: PackInput[] };
  if (!curso || !Array.isArray(packs)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  await savePacks(campaign.id, curso, packs);
  return NextResponse.json({ ok: true });
}
