import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { listarLicencias, sincronizarLicencias, type Destino } from '@/lib/licencias-envios-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const isAdmin = () => hasModule('licencias');

/**
 * Las licencias de la campaña, enteras. Son ~2.000 filas para una carga y el filtrado va en el
 * navegador: la pantalla es «tipo Excel» y filtrar tiene que ser instantáneo, no un viaje a Neon
 * por cada clic.
 *
 * Con `?sync=1` primero pone al día las filas (materializa el censo del banco y las líneas de
 * pedido nuevas). La pantalla lo pide al entrar y con el botón «Actualizar».
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });

  const url = new URL(request.url);
  const destino = (url.searchParams.get('destino') === 'familia' ? 'familia' : 'alumno') as Destino;
  const sync = url.searchParams.get('sync') === '1' ? await sincronizarLicencias(campaign.id) : null;
  const { filas, resumen } = await listarLicencias(campaign.id, destino);

  return NextResponse.json({
    campaign: { id: campaign.id, academicYear: campaign.academicYear, name: campaign.name },
    filas,
    resumen,
    sync,
  });
}
