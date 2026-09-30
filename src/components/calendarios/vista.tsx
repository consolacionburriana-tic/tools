'use client';

// Las dos caras de /gestion/calendarios: los calendarios que deja Classroom y las propias
// clases. El escaneo (en la de calendarios) rellena las dos.
import { useState } from 'react';
import { CalendarDays, GraduationCap } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { CalendarioFila, ClaseFila } from '@/lib/calendarios';
import { PanelCalendarios } from './panel';
import { PanelClases } from './clases';

export function VistaCalendarios({
  calendarios,
  clases,
  errorInicial,
}: {
  calendarios: CalendarioFila[];
  clases: ClaseFila[];
  errorInicial: string | null;
}) {
  const [vista, setVista] = useState<'calendarios' | 'clases'>('calendarios');
  return (
    <div className="space-y-5">
      <div className="flex w-fit rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
        {(
          [
            ['calendarios', 'Calendarios', CalendarDays],
            ['clases', 'Clases de Classroom', GraduationCap],
          ] as const
        ).map(([v, l, Icono]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              haptic.tap();
              setVista(v);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
              vista === v
                ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <Icono className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>
      {vista === 'calendarios' ? (
        <PanelCalendarios iniciales={calendarios} errorInicial={errorInicial} />
      ) : (
        <PanelClases iniciales={clases} />
      )}
    </div>
  );
}
