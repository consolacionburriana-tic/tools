import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Una fila de formulario: etiqueta arriba, el control, y debajo la ayuda o el error.
 * Pasa `id` y úsalo en el control para que la etiqueta lo enfoque al tocarla; el error se
 * anuncia (`role="alert"`) y el control debería llevar `aria-invalid`.
 */
export function Campo({
  etiqueta,
  id,
  ayuda,
  error,
  opcional,
  className,
  children,
}: {
  etiqueta: React.ReactNode;
  id?: string;
  ayuda?: React.ReactNode;
  error?: React.ReactNode;
  /** Pinta «(opcional)» junto a la etiqueta. Lo normal es que todo sea obligatorio. */
  opcional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{ayuda}</p>
      ) : null}
    </div>
  );
}
