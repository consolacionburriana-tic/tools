'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Bus, CalendarDays, ChevronRight, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agruparPorNivel, claseLabel, cursoDeSalida, tripArchivada } from '@/lib/salidas';
import { NavPending } from '@/components/ui/nav-pending';
import { buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Progreso } from '@/components/ui/progreso';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
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
    <div className="space-y-4">
      {soloMias && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ves las salidas que has creado o de las que eres responsable.</p>
      )}

      <Filtros etiqueta="Mostrar">
        <Filtro activo={!verPasadas} onClick={() => setVerPasadas(false)} cuenta={activas.length}>
          Activas
        </Filtro>
        <Filtro activo={verPasadas} onClick={() => setVerPasadas(true)} cuenta={pasadas.length}>
          Pasadas
        </Filtro>
      </Filtros>

      {visibles.length === 0 ? (
        verPasadas ? (
          <Vacio icono={<Archive />} titulo="Ninguna salida pasada todavía">
            Se archivan solas a los 3 días de su fecha.
          </Vacio>
        ) : (
          <Vacio
            icono={<Bus />}
            titulo="Todavía no hay ninguna salida"
            accion={
              <Link href="/gestion/salidas/nueva" className={buttonVariants()}>
                <Plus aria-hidden /> Nueva salida
              </Link>
            }
          >
            Crea la primera y comparte el enlace con las familias.
          </Vacio>
        )
      ) : (
        <div className="anim-stagger space-y-6">
          {grupos.map((g) => (
            <section key={g.curso} className="space-y-3">
              <Rotulo>Curso {g.curso}</Rotulo>
              {/* Y dentro, por NIVEL y de menos a más: así se ve de un vistazo que hay dos
                  salidas de 1º, dos de 2º… en vez de una lista seguida. */}
              {agruparPorNivel(g.trips).map((n) => (
                <div key={n.nivel || 'sin-clase'} className="space-y-2.5">
                  <div className="flex items-center gap-2 pl-0.5">
                    <h3 className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">{n.etiqueta}</h3>
                    <span aria-hidden className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      {n.salidas.length} {n.salidas.length === 1 ? 'salida' : 'salidas'}
                    </span>
                  </div>
                  {n.salidas.map((t) => (
                    <TripCard key={t.id} trip={t} />
                  ))}
                </div>
              ))}
            </section>
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
      className={cn(
        claseTarjeta,
        'group block p-4 transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-zinc-50 dark:hover:border-zinc-700 dark:active:bg-zinc-800/60',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
            {t.nombre}
            <Estado tono={t.estado === 'abierta' ? 'ok' : 'neutro'}>{t.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</Estado>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {t.fecha && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden className="h-4 w-4" />
                {new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {t.importe && <span className="tabular-nums">{t.importe} €</span>}
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="h-4 w-4" />
              {(t.clases ?? []).map((c) => claseLabel(c)).join(', ')}
            </span>
            {t.responsables.length > 0 && <span>Resp.: {t.responsables.map((r) => r.nombre).join(', ')}</span>}
          </p>
        </div>
        <NavPending className="shrink-0" />
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500"
        />
      </div>
      <Progreso className="mt-3" hechos={t.stats.entregados} total={entregables} etiqueta={`Justificantes de ${t.nombre}`} />
      <p className="mt-1.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {t.stats.entregados}/{entregables} justificantes ({pct} %) · {t.stats.pendientes} pendientes · {t.stats.noVan} no van
      </p>
    </Link>
  );
}
