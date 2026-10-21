import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { claseCampo } from '@/components/ui/input';

/**
 * Desplegable nativo con la receta de campo. Nativo a propósito: en el iPad abre la rueda
 * del sistema, que es lo más cómodo con el dedo. Para buscar entre muchas opciones, mejor un
 * buscador que una lista de 300 nombres.
 */
export function Selector({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <span className={cn('relative block w-full', className)}>
      <select {...props} className={cn(claseCampo, 'cursor-pointer appearance-none pr-10')}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
      />
    </span>
  );
}
