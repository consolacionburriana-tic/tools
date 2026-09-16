import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import {
  estadoDrive,
  generarPdfs,
  generarPedidos,
  getUltimaTirada,
  marcarTiradaPedida,
  previsualizarPedidos,
} from '@/lib/licencias-pedidos-server';

const isAdmin = () => hasModule('licencias');

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  const [drive, previa, tirada] = await Promise.all([
    estadoDrive(),
    previsualizarPedidos(campaign.id),
    getUltimaTirada(campaign.id),
  ]);
  return NextResponse.json({ drive, previa, tirada });
}

const schema = z.object({ accion: z.enum(['generar', 'pdf', 'marcar']), tiradaId: z.string().uuid().optional() });

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  try {
    const { accion, tiradaId } = schema.parse(await request.json());

    if (accion === 'generar') {
      const drive = await estadoDrive();
      if (!drive.ok) return NextResponse.json({ error: drive.error ?? 'Drive no está listo' }, { status: 400 });
      const res = await generarPedidos(campaign.id, campaign.academicYear.replace('/', '-'));
      return NextResponse.json({ ok: true, ...res });
    }

    // Los dos pasos siguientes actúan sobre una tirada concreta: la que se acaba de generar,
    // no sobre lo que haya pendiente ahora.
    const id = tiradaId ?? (await getUltimaTirada(campaign.id))[0]?.tiradaId;
    if (!id) return NextResponse.json({ error: 'No hay ninguna tirada que procesar' }, { status: 400 });

    if (accion === 'pdf') return NextResponse.json({ ok: true, ...(await generarPdfs(id)) });
    return NextResponse.json({ ok: true, ...(await marcarTiradaPedida(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
