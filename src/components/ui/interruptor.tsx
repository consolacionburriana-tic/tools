'use client';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

function Pista({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', activo ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600')}
    >
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', activo ? 'left-[1.125rem]' : 'left-0.5')} />
    </span>
  );
}

/**
 * Sí/no que se aplica al momento (en un formulario que se guarda con botón, mejor una casilla).
 * La fila entera es el botón: 44 px de alto como mínimo. Azul cuando está encendido.
 * Con `etiquetaOculta` queda solo el interruptor (dentro de una fila de tabla, p. ej.), con
 * su zona táctil de 44 px y la etiqueta para el lector de pantalla.
 */
export function Interruptor({
  activo,
  onChange,
  etiqueta,
  descripcion,
  etiquetaOculta = false,
  disabled,
  className,
}: {
  activo: boolean;
  onChange: (activo: boolean) => void;
  etiqueta: React.ReactNode;
  descripcion?: React.ReactNode;
  etiquetaOculta?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  if (etiquetaOculta) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={disabled}
        onClick={() => {
          haptic.tap();
          onChange(!activo);
        }}
        className={cn(
          'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50',
          className,
        )}
      >
        <span className="sr-only">{etiqueta}</span>
        <Pista activo={activo} />
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onChange(!activo);
      }}
      className={cn(
        'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{etiqueta}</span>
        {descripcion && <span className="block text-sm text-zinc-500 dark:text-zinc-400">{descripcion}</span>}
      </span>
      <Pista activo={activo} />
    </button>
  );
}
