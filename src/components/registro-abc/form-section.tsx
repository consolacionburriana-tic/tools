'use client';

import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Etiqueta } from '@/components/ui/etiqueta';

interface FormSectionProps {
  title: string;
  required?: boolean;
  multiselect?: boolean;
  /** Solo en las obligatorias: si ya está contestada, el círculo se llena de verde. */
  hecho?: boolean;
  /** Sin caja propia (dentro del bloque opcional, que ya es una caja). */
  plano?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function FormSection({ title, required, multiselect, hecho, plano, error, children }: FormSectionProps) {
  return (
    <section
      className={cn(
        'space-y-3',
        !plano &&
          'rounded-2xl border bg-white p-4 transition-colors sm:p-5 dark:bg-zinc-900 ' +
            (error ? 'border-red-300 dark:border-red-900' : hecho ? 'border-emerald-200 dark:border-emerald-900/60' : 'border-zinc-200 dark:border-zinc-800'),
      )}
      data-campo-error={error ? 'true' : undefined}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {required && (
          <span
            aria-hidden
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              hecho
                ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950'
                : 'border-zinc-300 dark:border-zinc-600',
            )}
          >
            {hecho && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        )}
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
        {required && (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400" aria-label={hecho ? 'obligatorio, hecho' : 'obligatorio, pendiente'}>
            *
          </span>
        )}
        {multiselect && <Etiqueta className="select-none">selección múltiple</Etiqueta>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

interface OptionalBlockProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Bloque opcional plegado por defecto: se ve claramente que no hace falta rellenarlo. */
export function OptionalBlock({ title, open, onToggle, children }: OptionalBlockProps) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Etiqueta>Opcional</Etiqueta>
        <span className="flex-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-5 pt-1 space-y-8">{children}</div>}
    </div>
  );
}
