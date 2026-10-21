'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Selector } from '@/components/ui/selector';
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
    <Selector
      value={actual}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.set('periodo', e.target.value);
        router.push(`${basePath}?${p.toString()}`);
      }}
      className="w-auto min-w-52"
      aria-label="Periodo del horario"
    >
      {periodos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} · {p.academicYear}
        </option>
      ))}
    </Selector>
  );
}
