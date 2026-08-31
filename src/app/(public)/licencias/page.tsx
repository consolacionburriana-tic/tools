export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { campaignAbierta, fechaLimiteLabel } from '@/lib/licencias';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { LicenciasForm } from '@/components/licencias/licencias-form';

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

  // ¿El pedido se procesa antes del inicio de curso? (7 de septiembre del año de inicio)
  const startYear = campaign ? parseInt(campaign.academicYear, 10) : new Date().getFullYear();
  const processedBeforeStart = new Date() < new Date(startYear, 8, 7);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="anim-stagger mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
            <Image
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={250}
              height={125}
              priority
              className="h-auto w-[210px] sm:w-[250px]"
            />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Solicitud de licencias digitales 📲
          </h1>
          {campaign && <p className="mt-1 text-sm text-zinc-500">Curso {campaign.academicYear}</p>}
        </div>

        {!campaign || !abierta ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-zinc-600 dark:text-zinc-300">
            {campaign?.orderDeadline ? (
              <>El plazo de petición de licencias se cerró el {fechaLimiteLabel(campaign.orderDeadline)}.</>
            ) : (
              'En este momento no hay ninguna solicitud de licencias abierta.'
            )}
          </div>
        ) : (
          <LicenciasForm
            campaignName={campaign.name}
            deadline={campaign.orderDeadline}
            noteText={campaign.noteText}
            processedBeforeStart={processedBeforeStart}
            tokenAcceso={tokenAcceso}
          />
        )}
      </main>
    </div>
  );
}
