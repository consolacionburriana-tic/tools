export const dynamic = 'force-dynamic';

import { LenguasClase } from '@/components/licencias/lenguas-clase';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { Vacio } from '@/components/ui/vacio';
import { getCurrentCampaign, getLenguasPorClase } from '@/lib/licencias-server';

export const metadata = { title: 'Idioma por clase · Licencias' };

export default async function LenguasPage() {
  const campaign = await getCurrentCampaign();
  const clases = campaign ? await getLenguasPorClase(campaign.id) : [];
  return (
    <Subpantalla ancho="estrecho" titulo="Idioma por clase" descripcion="Castellano o valencià, clase a clase.">
      {campaign ? <LenguasClase inicial={clases} /> : <Vacio titulo="No hay campaña activa" />}
    </Subpantalla>
  );
}
