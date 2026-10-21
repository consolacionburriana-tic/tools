'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tarjeta } from '@/components/ui/tarjeta';

// Un «cubo» de una vista previa de sincronización (Altas, Cambios, Bajas, Sin cambios): la
// fila con su icono, su nombre y cuántos hay, que se despliega para ver el detalle. Es el
// mismo en la BBDD central y en los syncs de Licencias y Banco de libros, para que una
// vista previa se lea igual venga de donde venga. Neutro a propósito: «altas» no es un
// estado bueno ni «bajas» uno malo, así que nada de verde ni rojo aquí.

export function Cubo({
  icono,
  titulo,
  n,
  abierto,
  onToggle,
  className,
  children,
}: {
  icono?: React.ReactNode;
  titulo: React.ReactNode;
  n: number;
  abierto: boolean;
  onToggle: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const vacio = n === 0;
  return (
    <Tarjeta className={className}>
      <button
        type="button"
        onClick={onToggle}
        disabled={vacio}
        aria-expanded={vacio ? undefined : abierto}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
      >
        <span
          className={cn(
            'flex min-w-0 items-center gap-2 text-sm font-medium [&_svg]:size-4 [&_svg]:shrink-0',
            vacio ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100',
          )}
        >
          {icono && <span className="text-zinc-500 dark:text-zinc-400">{icono}</span>}
          {titulo}
          <span className="font-mono text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{n}</span>
        </span>
        {!vacio && (
          <ChevronDown
            aria-hidden
            className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400', abierto && 'rotate-180')}
          />
        )}
      </button>
      {abierto && !vacio && <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">{children}</div>}
    </Tarjeta>
  );
}
