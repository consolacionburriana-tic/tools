export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, KeyRound } from 'lucide-react';
import { CorreosForm } from '@/components/licencias/correos-form';
import { appBaseUrl } from '@/lib/constants';
import { getClasesCampaign, getCurrentCampaign } from '@/lib/licencias-server';

export const metadata = { title: 'Correos · Licencias' };

export default async function CorreosPage() {
  const campaign = await getCurrentCampaign();
  const clases = campaign ? await getClasesCampaign(campaign.id) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Correos</h1>
            <p className="text-xs text-zinc-500">Apertura del plazo, recordatorios y avisos a las familias</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gestion/licencias/accesos"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <KeyRound className="h-4 w-4" /> Enlaces
            </Link>
            <Link
              href="/gestion/licencias"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" /> Panel
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!campaign ? (
          <p className="text-zinc-500">No hay campaña activa.</p>
        ) : (
          <CorreosForm
            clases={clases}
            deadline={campaign.orderDeadline}
            academicYear={campaign.academicYear}
            baseUrl={appBaseUrl()}
          />
        )}
      </main>
    </div>
  );
}
