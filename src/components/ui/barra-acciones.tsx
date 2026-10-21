'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ANCHO_PAGINA, type AnchoPagina } from '@/components/ui/ancho';

// La barra fija de abajo: «Guardar registro», «Borrar 4 calendarios», «Aplicar 23 cambios».
// Los recuentos van dentro de los botones. Deja sitio a la derecha al botón de Tareas y
// respeta la barra de inicio del iPhone. Va a `document.body` (portal) para que ningún
// contenedor animado la descoloque, y deja debajo de la página un hueco de su altura para
// que no tape lo último de la lista.

const vacio = () => () => {};

export function BarraAcciones({
  visible = true,
  resumen,
  ancho = 'normal',
  className,
  children,
}: {
  visible?: boolean;
  /** Texto a la izquierda («4 seleccionados»). */
  resumen?: React.ReactNode;
  ancho?: AnchoPagina;
  className?: string;
  children: React.ReactNode;
}) {
  const montado = useSyncExternalStore(vacio, () => true, () => false);
  if (!montado || !visible) return null;
  return (
    <>
      <div aria-hidden className="h-24" />
      {createPortal(
        <div className="anim-up fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 print:hidden">
          <div className={cn('mx-auto flex items-center gap-3 py-3 pr-16 pl-4', ANCHO_PAGINA[ancho], className)}>
            {resumen && <div className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-300">{resumen}</div>}
            <div className={cn('flex items-center gap-2', resumen ? 'shrink-0' : 'w-full justify-end')}>{children}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
