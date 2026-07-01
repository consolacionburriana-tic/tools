export const dynamic = 'force-dynamic';

import { getCurrentCampaign } from '@/lib/licencias-server';
import { LicenciasForm } from '@/components/licencias/licencias-form';

export const metadata = {
  title: 'Solicitud de licencias digitales · Consolación',
  description: 'Solicitud de licencias digitales · curso 2026/2027',
};

export default async function LicenciasPage() {
  const campaign = await getCurrentCampaign();

  // ¿El pedido se procesa antes del inicio de curso? (7 de septiembre del año de inicio)
  const startYear = campaign ? parseInt(campaign.academicYear, 10) : new Date().getFullYear();
  const processedBeforeStart = new Date() < new Date(startYear, 8, 7);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={250}
              height={125}
              className="h-auto w-[210px] sm:w-[250px]"
            />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Solicitud de licencias digitales 📲
          </h1>
          {campaign && <p className="mt-1 text-sm text-zinc-500">Curso {campaign.academicYear}</p>}
        </div>

        {!campaign || campaign.status !== 'open' ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-zinc-600 dark:text-zinc-300">
            En este momento no hay ninguna solicitud de licencias abierta.
          </div>
        ) : (
          <LicenciasForm
            campaignName={campaign.name}
            deadline={campaign.orderDeadline}
            processedBeforeStart={processedBeforeStart}
          />
        )}
      </main>
    </div>
  );
}
