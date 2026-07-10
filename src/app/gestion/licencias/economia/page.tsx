export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, PiggyBank } from 'lucide-react';
import { getCurrentCampaign, getDashboardStats } from '@/lib/licencias-server';
import { euros } from '@/lib/licencias';

export const metadata = { title: 'Gestión económica · Licencias' };

export default async function EconomiaPage() {
  const campaign = await getCurrentCampaign();
  const stats = campaign ? await getDashboardStats(campaign.id) : null;
  const conIngresos = stats?.porCurso.filter((c) => c.conPedido > 0) ?? [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Gestión económica</h1>
            <p className="text-xs text-zinc-500">{campaign?.name ?? 'Sin campaña'}</p>
          </div>
          <Link
            href="/gestion/licencias"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!stats ? (
          <p className="text-zinc-500">No hay campaña activa.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                <PiggyBank className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-zinc-500">Ingresos previstos (pedidos confirmados)</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{euros(stats.ingresos)}</p>
              </div>
            </div>

            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Por curso</h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Curso</th>
                      <th className="px-4 py-2 text-right font-medium">Pedidos</th>
                      <th className="px-4 py-2 text-right font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {conIngresos.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-center text-zinc-400">
                          Aún no hay pedidos.
                        </td>
                      </tr>
                    )}
                    {conIngresos.map((c) => (
                      <tr key={c.curso} className="bg-white dark:bg-zinc-900">
                        <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{c.curso}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{c.conPedido}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">{euros(c.ingresos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-6 text-xs text-zinc-400">
              Próximamente: informe de pagos consolidado, fichero para Educamos y pagos por libro/editorial.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
