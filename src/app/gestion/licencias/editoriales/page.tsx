export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EditorialReport } from '@/components/licencias/editorial-report';
import { PedidosDrive } from '@/components/licencias/pedidos-drive';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { estadoDrive, getUltimaTirada, previsualizarPedidos } from '@/lib/licencias-pedidos-server';

export const metadata = { title: 'Editoriales · Licencias' };

export default async function EditorialesPage() {
  const campaign = await getCurrentCampaign();
  const [drive, previa, tirada] = campaign
    ? await Promise.all([estadoDrive(), previsualizarPedidos(campaign.id), getUltimaTirada(campaign.id)])
    : [null, null, []];
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Editoriales</h1>
            <p className="text-xs text-zinc-500">Generar y mandar los pedidos</p>
          </div>
          <Link
            href="/gestion/licencias"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {drive && previa && (
          <PedidosDrive
            drive={drive}
            previa={previa}
            tirada={JSON.parse(JSON.stringify(tirada))}
          />
        )}
        <EditorialReport />
      </main>
    </div>
  );
}
