import { cn } from '@/lib/utils';

/**
 * Un dato corto con caja gris: la clase («2ESO B»), un código, una ruta de unidad. No es un
 * estado (eso es `Estado`) ni se pulsa. `mono` para códigos y rutas.
 */
export function Etiqueta({
  mono = false,
  title,
  className,
  children,
}: {
  mono?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-block max-w-full shrink-0 truncate rounded-md bg-zinc-100 px-1.5 py-0.5 align-middle text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        mono && 'font-mono',
        className,
      )}
    >
      {children}
    </span>
  );
}
