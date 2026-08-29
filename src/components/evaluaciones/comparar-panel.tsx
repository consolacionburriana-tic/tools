'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { audienciaLabel, tonoDe } from '@/lib/evaluaciones';
import type { PuntoChart } from '@/components/evaluaciones/comparativa-chart';

// recharts es la dependencia de cliente más pesada del repo: solo la descarga esta vista.
const ComparativaChart = dynamic(() => import('@/components/evaluaciones/comparativa-chart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />,
});

const TONO_TEXTO: Record<string, string> = {
  bien: 'text-emerald-600 dark:text-emerald-400',
  regular: 'text-amber-600 dark:text-amber-400',
  flojo: 'text-rose-600 dark:text-rose-400',
  sin: 'text-zinc-400',
};

export function ComparativaSerie({ nombre, puntos }: { nombre: string; puntos: PuntoChart[] }) {
  const conDatos = puntos.filter((p) => p.mediaPct !== null);
  const porAudiencia = [...new Set(puntos.map((p) => p.audiencia))];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="mb-1 font-bold text-zinc-900 dark:text-zinc-100">{nombre}</h2>
        <p className="mb-3 text-xs text-zinc-500">
          {puntos.length} evaluación(es) de esta actividad · responden {porAudiencia.map(audienciaLabel).join(' y ')}
        </p>
        {conDatos.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Todavía no hay respuestas que comparar.</p>
        ) : (
          <ComparativaChart puntos={puntos} />
        )}
      </div>

      <div className="space-y-2">
        {puntos.map((p) => (
          <Link
            key={p.formId}
            href={`/gestion/evaluaciones/${p.formId}/resultados`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:bg-zinc-900 dark:ring-zinc-800"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.titulo}</p>
              <p className="text-xs text-zinc-500">
                {p.academicYear} · {audienciaLabel(p.audiencia)} · {p.respuestas} respuestas
              </p>
            </div>
            <span className={`shrink-0 text-lg font-bold tabular-nums ${TONO_TEXTO[tonoDe(p.mediaPct)]}`}>
              {p.mediaPct === null ? '—' : Math.round(p.mediaPct)}
              <span className="text-[10px] font-normal text-zinc-400"> / 100</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
