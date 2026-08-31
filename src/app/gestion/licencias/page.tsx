export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BookMarked, ChevronLeft, Download, KeyRound, Layers, ListOrdered, Mail, PiggyBank, RefreshCw, Users } from 'lucide-react';
import { campaignAbierta, fechaLimiteLabel } from '@/lib/licencias';
import { getCurrentCampaign, getDashboardStats } from '@/lib/licencias-server';
import { NavArrow } from '@/components/ui/nav-pending';

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
  const abierta = campaign ? campaignAbierta(campaign) : false;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Panel de licencias</h1>
              <p className="text-xs text-zinc-500">{campaign?.name ?? 'Sin campaña'}</p>
            </div>
            <div className="flex items-center gap-2">
              {campaign && (
                <>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      abierta
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    {abierta ? 'Abierta' : campaign.status === 'draft' ? 'Borrador' : 'Cerrada'}
                  </span>
                  <form action="/api/licencias/admin/campaign" method="post">
                    <input type="hidden" name="status" value={campaign.status === 'open' ? 'closed' : 'open'} />
                    <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">
                      {campaign.status === 'open' ? 'Cerrar' : 'Abrir'}
                    </button>
                  </form>
                </>
              )}
              <Link
                href="/gestion"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> Escritorio
              </Link>
            </div>
          </div>

          {campaign && (
            <div className="mt-2 text-xs text-zinc-500">
              {!abierta && campaign.orderDeadline && (
                <p className="mb-2 text-amber-600 dark:text-amber-400">
                  El plazo de petición de licencias se cerró el {fechaLimiteLabel(campaign.orderDeadline)}.
                </p>
              )}
              <form action="/api/licencias/admin/campaign" method="post" className="flex flex-col gap-2 sm:max-w-md">
                <div className="flex items-center gap-2">
                  <label htmlFor="orderDeadline" className="shrink-0">
                    Cierre automático (23:59 de ese día):
                  </label>
                  <input
                    id="orderDeadline"
                    type="date"
                    name="orderDeadline"
                    defaultValue={campaign.orderDeadline ?? ''}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="noteText">Texto informativo (bajo el título del formulario de familias):</label>
                  <textarea
                    id="noteText"
                    name="noteText"
                    rows={2}
                    defaultValue={campaign.noteText ?? ''}
                    placeholder="Las licencias digitales no son obligatorias. Marca solo las que quieras solicitar."
                    className="w-full resize-y rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <button className="self-start rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">
                  Guardar
                </button>
              </form>
            </div>
          )}
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
                href="/gestion/licencias/pedidos"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <ListOrdered className="h-4 w-4 text-blue-600" />
                Pedidos
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/editoriales"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <BookMarked className="h-4 w-4 text-purple-600" />
                Editoriales
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/packs"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <Layers className="h-4 w-4 text-purple-600" />
                Packs / itinerarios
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/faltan"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <Users className="h-4 w-4 text-blue-600" />
                Quién falta
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/exportar"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <Download className="h-4 w-4 text-blue-600" />
                Exportar
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/economia"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <PiggyBank className="h-4 w-4 text-emerald-600" />
                Económica
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/correos"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <Mail className="h-4 w-4 text-blue-600" />
                Correos
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/accesos"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <KeyRound className="h-4 w-4 text-amber-600" />
                Enlaces de familias
                <NavArrow className="ml-auto" />
              </Link>
              <Link
                href="/gestion/licencias/sincronizar"
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:border-blue-600 dark:active:bg-blue-500/10"
              >
                <RefreshCw className="h-4 w-4 text-emerald-600" />
                Sincronizar
                <NavArrow className="ml-auto" />
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
              Pendiente (requiere credenciales externas): escritura directa en el Google Sheet (cuenta de
              servicio de Google) y sincronización con la API de Educamos.{' '}
              <Link href="/" className="underline">Inicio</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
