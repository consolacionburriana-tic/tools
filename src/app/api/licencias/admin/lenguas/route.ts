import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign, getLenguasPorClase, setLenguaClase } from '@/lib/licencias-server';

const isAdmin = () => hasModule('licencias');

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  return NextResponse.json({ clases: await getLenguasPorClase(campaign.id) });
}

const schema = z.object({
  curso: z.string().min(1),
  letra: z.string(),
  lengua: z.enum(['CAS', 'VAL']).nullable(),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  try {
    const { curso, letra, lengua } = schema.parse(await request.json());
    const n = await setLenguaClase(campaign.id, curso, letra, lengua);
    return NextResponse.json({ ok: true, actualizados: n });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
