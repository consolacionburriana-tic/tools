export const dynamic = 'force-dynamic';

import { FaltanList } from '@/components/licencias/faltan-list';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { Vacio } from '@/components/ui/vacio';
import { getCurrentCampaign, getMissingStudents } from '@/lib/licencias-server';

export const metadata = { title: 'Quién falta · Licencias' };

export default async function FaltanPage() {
  const campaign = await getCurrentCampaign();
  const data = campaign ? await getMissingStudents(campaign.id) : [];

  return (
    <Subpantalla
      ancho="medio"
      titulo="Quién falta"
      descripcion={`Alumnos sin pedido · ${data.filter((s) => !s.manualCompletedAt).length}`}
    >
      {!campaign ? <Vacio titulo="No hay campaña activa" /> : <FaltanList data={data} />}
    </Subpantalla>
  );
}
