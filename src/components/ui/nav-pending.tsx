'use client';

import { useLinkStatus } from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Indicador de "esta navegación está en marcha", para usar DENTRO de un <Link>.
 *
 * Por qué existe: los paneles de /gestion son `force-dynamic` (consultan Neon en
 * cada carga), así que entre el toque y el cambio de pantalla hay un viaje al
 * servidor. Los `loading.tsx` evitan que la pantalla se quede congelada, pero en
 * una lista de tarjetas hace falta además saber *cuál* has pulsado.
 *
 * El hueco se reserva siempre (opacidad 0 → 1) para que al aparecer la ruedecita
 * no se muevan los elementos de al lado.
 */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center transition-opacity duration-150',
        pending ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
    </span>
  );
}

/**
 * Flecha de "ir a" que se convierte en ruedecita mientras carga. Ocupa la misma
 * caja en ambos estados, así que el cambio no mueve nada de la fila.
 */
export function NavArrow({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center', className)}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
      ) : (
        <span className="text-zinc-400">→</span>
      )}
    </span>
  );
}
