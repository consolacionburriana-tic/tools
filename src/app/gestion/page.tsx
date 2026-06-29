export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { LogOut, PiggyBank, Users } from 'lucide-react';
import { getCurrentCampaign, getDashboardStats } from '@/lib/licencias-server';

export const metadata = { title: 'Panel · Licencias' };

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
    </div>
  );
}

export default async function GestionPage() {
  const campaign = await getCurrentCampaign();
  const stats = campaign ? await getDashboardStats(campaign.id) : null;
  const pct = stats && stats.totalStudents > 0 ? Math.round((stats.conPedido / stats.totalStudents) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Panel de licencias</h1>
            <p className="text-xs text-zinc-500">{campaign?.name ?? 'Sin campaña'}</p>
          </div>
          <form action="/api/licencias/admin/logout" method="post">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!stats ? (
          <p className="text-zinc-500">No hay campaña activa.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Alumnos" value={String(stats.totalStudents)} />
              <Kpi label="Con pedido" value={`${stats.conPedido} · ${pct}%`} />
              <Kpi label="Faltan" value={String(stats.sinPedido)} accent />
              <Kpi label="Licencias" value={String(stats.totalLicencias)} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link
                href="/gestion/faltan"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Users className="h-4 w-4 text-blue-600" />
                Quién falta (listado y CSV)
                <span className="ml-auto text-zinc-400">→</span>
              </Link>
              <Link
                href="/gestion/economia"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <PiggyBank className="h-4 w-4 text-emerald-600" />
                Gestión económica
                <span className="ml-auto text-zinc-400">→</span>
              </Link>
            </div>

            <section className="mt-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                <Users className="h-4 w-4" /> Por curso
              </h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Curso</th>
                      <th className="px-4 py-2 text-right font-medium">Alumnos</th>
                      <th className="px-4 py-2 text-right font-medium">Con pedido</th>
                      <th className="px-4 py-2 text-right font-medium">Faltan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {stats.porCurso.map((c) => {
                      const pdc = c.curso.endsWith('PDC');
                      return (
                        <tr key={c.curso} className={pdc ? 'bg-zinc-50/60 dark:bg-zinc-800/30' : 'bg-white dark:bg-zinc-900'}>
                          <td className={`py-2.5 ${pdc ? 'pl-9 text-zinc-500 dark:text-zinc-400' : 'px-4 font-medium text-zinc-900 dark:text-zinc-100'}`}>
                            {pdc ? `↳ ${c.curso}` : c.curso}
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{c.total}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{c.conPedido}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${c.sinPedido > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`}>
                            {c.sinPedido}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-6 text-xs text-zinc-400">
              Próximamente: editor de packs/itinerarios, listado de quién falta y exportación a Google Sheets (hojas ENVIAR).{' '}
              <Link href="/" className="underline">Inicio</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
