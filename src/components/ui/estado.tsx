import { cn } from '@/lib/utils';

// El estado de algo, en una pastilla rellena suave: verde = hecho/sí, ámbar = falta algo,
// rojo = error/no, azul = informativo, gris = pendiente o sin dato. El texto dice siempre
// el estado (el color solo lo refuerza); el icono, si va, es de lucide y del mismo tono.

export type TonoEstado = 'ok' | 'aviso' | 'error' | 'info' | 'neutro';

export const TONO_ESTADO: Record<TonoEstado, string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  aviso: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  neutro: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function Estado({
  tono,
  icono,
  title,
  className,
  children,
}: {
  tono: TonoEstado;
  icono?: React.ReactNode;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0',
        TONO_ESTADO[tono],
        className,
      )}
    >
      {icono}
      {children}
    </span>
  );
}
