'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Users } from 'lucide-react';
import { claseLabel, cursoDeSalida, tripArchivada } from '@/lib/salidas';
import { NavPending } from '@/components/ui/nav-pending';
import type { TripConStats } from '@/lib/salidas-server';

export function SalidasList({ trips, soloMias }: { trips: TripConStats[]; soloMias: boolean }) {
  const [verPasadas, setVerPasadas] = useState(false);

  const { activas, pasadas } = useMemo(() => {
    const activas: TripConStats[] = [];
    const pasadas: TripConStats[] = [];
    for (const t of trips) (tripArchivada(t.fecha) ? pasadas : activas).push(t);
    return { activas, pasadas };
  }, [trips]);

  const visibles = verPasadas ? pasadas : activas;
  const grupos = useMemo(() => agruparPorCurso(visibles), [visibles]);

  return (
    <div className="space-y-3">
      {soloMias && (
        <p className="text-xs text-zinc-400">Ves las salidas que has creado o de las que eres responsable.</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setVerPasadas(false)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            !verPasadas ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          Activas ({activas.length})
        </button>
        <button
          type="button"
          onClick={() => setVerPasadas(true)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            verPasadas ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          Pasadas ({pasadas.length})
        </button>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          {verPasadas
            ? 'Ninguna salida pasada todavía: se archivan solas a los 3 días de su fecha.'
            : 'Todavía no hay ninguna salida. Crea la primera con "Nueva salida".'}
        </div>
      ) : (
        <div className="anim-stagger space-y-4">
          {grupos.map((g) => (
            <div key={g.curso} className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Curso {g.curso}
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="space-y-2.5">
                {g.trips.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Agrupa preservando el orden de llegada (los trips ya vienen ordenados por fecha
 *  descendente): no asume que un mismo curso quede contiguo. */
function agruparPorCurso(trips: TripConStats[]): { curso: string; trips: TripConStats[] }[] {
  const mapa = new Map<string, TripConStats[]>();
  for (const t of trips) {
    const curso = cursoDeSalida(t.fecha, t.createdAt);
    (mapa.get(curso) ?? mapa.set(curso, []).get(curso)!).push(t);
  }
  return [...mapa.entries()].map(([curso, trips]) => ({ curso, trips }));
}

function TripCard({ trip: t }: { trip: TripConStats }) {
  const entregables = Math.max(0, t.stats.objetivo - t.stats.noVan);
  const pct = entregables > 0 ? Math.round((t.stats.entregados / entregables) * 100) : 0;
  return (
    <Link
      href={`/gestion/salidas/${t.id}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700 dark:active:border-blue-600 dark:active:bg-blue-500/5"
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
        <NavPending className="shrink-0" />
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
}
