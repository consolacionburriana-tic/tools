export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Users } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { claseLabel, getTripsForUser } from '@/lib/salidas-server';

export const metadata = { title: 'Salidas · Gestión' };

export default async function SalidasListPage() {
  const user = (await getSessionUser())!;
  const trips = await getTripsForUser(user);
  const soloMias = user.role === 'profe' || user.role === 'tutor';

  return (
    <div className="space-y-3">
      {soloMias && (
        <p className="text-xs text-zinc-400">Ves las salidas que has creado o de las que eres responsable.</p>
      )}
      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Todavía no hay ninguna salida. Crea la primera con &quot;Nueva salida&quot;.
        </div>
      ) : (
        trips.map((t) => {
          const entregables = Math.max(0, t.stats.objetivo - t.stats.noVan);
          const pct = entregables > 0 ? Math.round((t.stats.entregados / entregables) * 100) : 0;
          return (
            <Link
              key={t.id}
              href={`/gestion/salidas/${t.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    {t.nombre}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.estado === 'abierta'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {t.estado}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    {t.fecha && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {t.importe && <span>{t.importe} €</span>}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {(t.clases ?? []).map((c) => claseLabel(c)).join(', ')}
                    </span>
                    {t.responsables.length > 0 && <span>Resp.: {t.responsables.map((r) => r.nombre).join(', ')}</span>}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
              </div>
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">
                  {t.stats.entregados}/{entregables} justificantes ({pct} %) · {t.stats.pendientes} pendientes ·{' '}
                  {t.stats.validados} validados · {t.stats.noVan} no van
                </p>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
