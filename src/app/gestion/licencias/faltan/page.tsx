export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCurrentCampaign, getMissingStudents } from '@/lib/licencias-server';
import { FaltanList } from '@/components/licencias/faltan-list';

export const metadata = { title: 'Quién falta · Licencias' };

export default async function FaltanPage() {
  const campaign = await getCurrentCampaign();
  const data = campaign ? await getMissingStudents(campaign.id) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Quién falta</h1>
            <p className="text-xs text-zinc-500">Alumnos sin pedido · {data.length}</p>
          </div>
          <Link
            href="/gestion/licencias"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!campaign ? <p className="text-zinc-500">No hay campaña activa.</p> : <FaltanList data={data} />}
      </main>
    </div>
  );
}
