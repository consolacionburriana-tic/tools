export const dynamic = 'force-dynamic';

import { EditorialReport } from '@/components/licencias/editorial-report';
import { PedidosDrive } from '@/components/licencias/pedidos-drive';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { estadoDrive, getUltimaTirada, previsualizarPedidos } from '@/lib/licencias-pedidos-server';

export const metadata = { title: 'Editoriales · Licencias' };

export default async function EditorialesPage() {
  const campaign = await getCurrentCampaign();
  const [drive, previa, tirada] = campaign
    ? await Promise.all([estadoDrive(), previsualizarPedidos(campaign.id), getUltimaTirada(campaign.id)])
    : [null, null, []];
  return (
    <Subpantalla ancho="estrecho" titulo="Editoriales" descripcion="Generar y mandar los pedidos.">
      <div className="space-y-8">
        {drive && previa && (
          <PedidosDrive drive={drive} previa={previa} tirada={JSON.parse(JSON.stringify(tirada))} />
        )}
        <EditorialReport />
      </div>
    </Subpantalla>
  );
}
