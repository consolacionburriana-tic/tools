'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Etiqueta } from '@/components/ui/etiqueta';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { BEHAVIORS } from '@/lib/constants';
import { FichaRegistroModal, type FichaRegistroData } from './ficha-registro';

/** Los últimos registros del panel: cada fila se pulsa y abre su ficha completa. */
export function UltimosRegistros({ fichas }: { fichas: FichaRegistroData[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <>
      <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
        {fichas.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setAbierto(r.id)}
              className="flex min-h-14 w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:hover:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.siglas}</span>
                  {r.behaviors.slice(0, 2).map((b) => (
                    <Etiqueta key={b}>{BEHAVIORS.find((x) => x.value === b)?.label ?? b.replace(/_/g, ' ')}</Etiqueta>
                  ))}
                  {r.behaviors.length > 2 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">+{r.behaviors.length - 2}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{r.registradoPor}</p>
              </div>
              <time className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {format(parseISO(r.reportDate), 'd MMM', { locale: es })}
              </time>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-zinc-400" />
            </button>
          </li>
        ))}
      </ul>
      <FichaRegistroModal fichas={fichas} abierto={abierto} onCambiar={setAbierto} />
    </>
  );
}
