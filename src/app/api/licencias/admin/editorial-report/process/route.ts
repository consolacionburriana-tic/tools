import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { toCsv } from '@/lib/licencias-exports';
import { getCurrentCampaign, getEditorialReport, markEditorialProcessed } from '@/lib/licencias-server';
import { INFORME_HEADER, informeCsvRows } from '@/lib/licencias-informe';


// Genera el CSV del informe pendiente y marca esos pedidos como "pedidos a la editorial" (🧾).
// Solo las licencias DE PAGO: las gratis del banco de libros van por su propio informe
// (./banco), porque no nacen de un pedido y su censo es completo, no incremental.
// El informe por editorial en el propio Sheet lo sigue generando el GAS existente, una vez
// los pedidos están sincronizados en las pestañas FORM26 (ver /gestion/sincronizar).
export async function POST() {
  if (!(await isAdmin())) return new Response('No autorizado', { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });

  const { rows, orderIds } = await getEditorialReport(campaign.id);
  if (rows.length === 0) return new Response('No hay pedidos pendientes de procesar', { status: 400 });

  await markEditorialProcessed(orderIds);

  return new Response(toCsv(INFORME_HEADER, informeCsvRows(rows)), {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="Informe-editoriales-${campaign.academicYear.replace('/', '-')}.csv"`,
    },
  });
}
