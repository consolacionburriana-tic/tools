import { hasModule } from '@/lib/auth-guards';
import { toCsv } from '@/lib/licencias-exports';
import { getBancoLibrosReport, getCurrentCampaign, markBancoReportDownloaded } from '@/lib/licencias-server';
import { INFORME_HEADER, informeCsvRows } from '@/lib/licencias-informe';

const isAdmin = () => hasModule('licencias');

// Informe de las licencias GRATIS del banco de libros, para pedírselas a la editorial.
// Censo completo (no incremental): a diferencia del de pago, estas no nacen de un pedido.
// Deja constancia de la descarga en la campaña para avisar de que ya se pidieron.
export async function POST() {
  if (!(await isAdmin())) return new Response('No autorizado', { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });

  const rows = await getBancoLibrosReport(campaign.id);
  if (rows.length === 0) return new Response('No hay licencias del banco de libros que pedir', { status: 400 });

  await markBancoReportDownloaded(campaign.id);

  return new Response(toCsv(INFORME_HEADER, informeCsvRows(rows)), {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="Informe-editoriales-BANCO-${campaign.academicYear.replace('/', '-')}.csv"`,
    },
  });
}
