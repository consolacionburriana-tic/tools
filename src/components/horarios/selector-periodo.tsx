'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import type { PeriodoListado } from '@/lib/horarios-server';

/**
 * Cambiar de periodo (ordinario / junio / septiembre). Solo aparece cuando hay más de uno:
 * mientras solo exista el ordinario, un desplegable de un elemento es ruido.
 */
export function SelectorPeriodo({
  periodos,
  actual,
  basePath = '/gestion/horarios',
}: {
  periodos: PeriodoListado[];
  actual: string;
  /** Otras pantallas con su propio selector de periodo (p. ej. "Mi horario") lo reusan. */
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <select
      value={actual}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.set('periodo', e.target.value);
        router.push(`${basePath}?${p.toString()}`);
      }}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      aria-label="Periodo del horario"
    >
      {periodos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} · {p.academicYear}
        </option>
      ))}
    </select>
  );
}
