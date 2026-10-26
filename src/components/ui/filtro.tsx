'use client';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

// Filtros de una lista: pastillas sueltas y la activa en negro (en oscuro, en blanco), con
// cuántos hay al lado. Para cambiar de VISTA, `Segmentado`. Las pastillas van dentro de
// `Filtros`, que les da nombre para el lector de pantalla («Mostrar»).

export function Filtros({
  etiqueta,
  className,
  children,
}: {
  etiqueta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

const PUNTO = {
  ok: 'bg-emerald-500',
  aviso: 'bg-amber-500',
  error: 'bg-red-500',
} as const;

// La activa, en negro. `acento="verde"` es solo del formulario rápido del Registro ABC (excepción
// decidida el 26-oct-2026, ver docs/diseno.md): verde 700 con texto blanco para que se lea.
const ACTIVO = {
  negro: 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900',
  verde: 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950',
} as const;

export function Filtro({
  activo,
  onClick,
  cuenta,
  icono,
  tono,
  acento = 'negro',
  disabled,
  className,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  cuenta?: number;
  icono?: React.ReactNode;
  /** Un punto de estado delante (pendientes en ámbar, hechos en verde) para leer la fila de un vistazo. */
  tono?: keyof typeof PUNTO;
  acento?: keyof typeof ACTIVO;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={cn(
        'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        activo
          ? ACTIVO[acento]
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className,
      )}
    >
      {tono && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', PUNTO[tono])} />}
      {icono}
      {children}
      {cuenta !== undefined && <span className="font-mono text-xs tabular-nums opacity-70">{cuenta}</span>}
    </button>
  );
}
