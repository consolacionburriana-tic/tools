import { cn } from '@/lib/utils';

/**
 * Cuando no hay nada que enseñar: qué pasa, por qué y qué se puede hacer. Caja discontinua
 * para que no se confunda con una tarjeta con datos. Sin emojis: el icono es de lucide.
 */
export function Vacio({
  icono,
  titulo,
  accion,
  className,
  children,
}: {
  icono?: React.ReactNode;
  titulo: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900',
        className,
      )}
    >
      {icono && (
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 [&_svg]:size-6">
          {icono}
        </span>
      )}
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{children}</div>}
      {accion && <div className="mt-5 flex flex-wrap justify-center gap-2">{accion}</div>}
    </div>
  );
}
