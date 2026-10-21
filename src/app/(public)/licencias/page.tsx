export const dynamic = 'force-dynamic';

import { campaignAbierta, fechaLimiteLabel, procesadoAntesDeCurso } from '@/lib/licencias';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { LicenciasForm } from '@/components/licencias/licencias-form';
import { PaginaFamilias } from '@/components/ui/pagina-familias';
import { Vacio } from '@/components/ui/vacio';

export const metadata = {
  title: 'Solicitud de licencias digitales · Consolación',
  description: 'Solicitud de licencias digitales · Colegio Consolación Burriana',
};

// Magic link de familias: `/licencias?t=tok_…` (se acepta `?tok=` como alias porque es lo
// que la gente teclea al copiar el enlace a mano). El token se valida al identificar.
export default async function LicenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tok?: string }>;
}) {
  const { t, tok } = await searchParams;
  const tokenAcceso = (t ?? tok ?? '').trim() || null;
  const campaign = await getCurrentCampaign();
  const abierta = campaign ? campaignAbierta(campaign) : false;

  const processedBeforeStart = procesadoAntesDeCurso(campaign?.academicYear ?? String(new Date().getFullYear()));

  return (
    <PaginaFamilias titulo="Solicitud de licencias digitales" subtitulo={campaign ? `Curso ${campaign.academicYear}` : undefined}>
      {!campaign || !abierta ? (
        <Vacio
          titulo={
            campaign?.orderDeadline
              ? `El plazo de petición de licencias se cerró el ${fechaLimiteLabel(campaign.orderDeadline)}.`
              : 'En este momento no hay ninguna solicitud de licencias abierta.'
          }
        />
      ) : (
        <LicenciasForm
          campaignName={campaign.name}
          deadline={campaign.orderDeadline}
          noteText={campaign.noteText}
          processedBeforeStart={processedBeforeStart}
          tokenAcceso={tokenAcceso}
        />
      )}
    </PaginaFamilias>
  );
}
