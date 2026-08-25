export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, GitCompare } from 'lucide-react';
import { academicYearActual } from '@/lib/constants';
import { audienciaLabel, categoriaLabel, opcionesAcademicYear, tonoDe } from '@/lib/evaluaciones';
import { getActividades, getComparativaSerie, getRankingActividades } from '@/lib/evaluaciones-server';
import { ComparativaSerie } from '@/components/evaluaciones/comparar-panel';

export const metadata = { title: 'Comparar · Evaluaciones' };

const TONO_BARRA: Record<string, string> = {
  bien: 'bg-emerald-500',
  regular: 'bg-amber-500',
  flojo: 'bg-rose-500',
  sin: 'bg-zinc-300 dark:bg-zinc-700',
};

/**
 * Dos comparativas, que son las dos preguntas reales: "¿cómo ha ido esto respecto a
 * otros años / respecto a lo que opinan los profes?" (serie) y "¿qué actividad ha
 * funcionado mejor este curso?" (ranking).
 */
export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ serie?: string; anio?: string }>;
}) {
  const { serie, anio } = await searchParams;
  const actual = academicYearActual();
  const year = anio ?? actual;

  if (serie) {
    const puntos = await getComparativaSerie(serie);
    const actividades = await getActividades({});
    const nombre = actividades.find((a) => a.serieId === serie)?.nombre ?? 'Actividad';
    return (
      <div className="space-y-4">
        <Link href="/gestion/evaluaciones/comparar" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Todas las comparativas
        </Link>
        <ComparativaSerie nombre={nombre} puntos={puntos} />
      </div>
    );
  }

  const [ranking, actividades] = await Promise.all([getRankingActividades(year), getActividades({})]);
  // Series con más de una edición: son las únicas que se pueden comparar entre sí.
  const porSerie = new Map<string, { nombre: string; ediciones: string[] }>();
  for (const a of actividades) {
    const actualSerie = porSerie.get(a.serieId) ?? { nombre: a.nombre, ediciones: [] };
    actualSerie.ediciones.push(a.academicYear);
    porSerie.set(a.serieId, actualSerie);
  }
  const comparables = [...porSerie.entries()].filter(([, v]) => v.ediciones.length > 1);

  return (
    <div className="anim-stagger space-y-5">
      <Link href="/gestion/evaluaciones" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
        <ChevronLeft className="h-4 w-4" /> Evaluaciones
      </Link>

      <div>
        <h2 className="mb-1 font-bold text-zinc-900 dark:text-zinc-100">La misma actividad, curso a curso</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Aparecen aquí las actividades que se han traído de un curso a otro (al copiarlas se mantiene el hilo entre ediciones).
        </p>
        {comparables.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Todavía no hay ninguna actividad con dos ediciones. Copia una del curso pasado y vuelve por aquí.
          </p>
        ) : (
          <div className="space-y-2">
            {comparables.map(([serieId, v]) => (
              <Link
                key={serieId}
                href={`/gestion/evaluaciones/comparar?serie=${serieId}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
              >
                <GitCompare className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.nombre}</span>
                  <span className="block text-xs text-zinc-500">{[...new Set(v.ediciones)].sort().join(' · ')}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Qué ha funcionado mejor en {year}</h2>
          <div className="flex flex-wrap gap-1.5">
            {opcionesAcademicYear(actual).slice(1, 4).map((y) => (
              <Link
                key={y}
                href={`/gestion/evaluaciones/comparar?anio=${y}`}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  y === year ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
        {ranking.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Sin respuestas todavía en {year}.
          </p>
        ) : (
          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {ranking.map((r, i) => (
              <Link key={`${r.formId}-${r.activityId}`} href={`/gestion/evaluaciones/${r.formId}/resultados`} className="block">
                <div className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-zinc-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">
                    {r.nombre}
                    <span className="ml-1.5 text-[10px] text-zinc-400">
                      {categoriaLabel(r.categoria)} · {audienciaLabel(r.audiencia)}
                    </span>
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {r.mediaPct === null ? '—' : Math.round(r.mediaPct)}
                  </span>
                </div>
                <div className="mt-1 ml-7 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className={`h-2 rounded-full ${TONO_BARRA[tonoDe(r.mediaPct)]}`} style={{ width: `${r.mediaPct ?? 0}%` }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
