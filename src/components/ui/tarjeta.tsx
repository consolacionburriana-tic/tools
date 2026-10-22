import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavPending } from '@/components/ui/nav-pending';

// La tarjeta de la app: borde fino, sin sombra, esquinas de 18 px. Es la caja de todo lo que
// se agrupa (una lista, un formulario, una tabla). `TarjetaEnlace` es la que lleva a otra
// pantalla entera. Los tableros (Tableros, Tareas) tienen sus propias tarjetas: son la excepción.

export const claseTarjeta = 'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

type Etiquetas = 'div' | 'section' | 'article' | 'li';

export function Tarjeta({
  as: Etiqueta = 'div',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: Etiquetas }) {
  return <Etiqueta className={cn(claseTarjeta, className)} {...props} />;
}

/** La franja de arriba de una tarjeta: título (h2), una frase y, a la derecha, una acción. */
export function TarjetaCabecera({
  titulo,
  descripcion,
  icono,
  accion,
  nivel = 'h2',
  id,
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: React.ReactNode;
  accion?: React.ReactNode;
  nivel?: 'h2' | 'h3';
  id?: string;
  className?: string;
}) {
  const Titulo = nivel;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800',
        className,
      )}
    >
      {icono && <span className="text-zinc-500 dark:text-zinc-400 [&_svg]:size-4">{icono}</span>}
      <div className="min-w-0 flex-1">
        <Titulo id={id} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {titulo}
        </Titulo>
        {descripcion && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{descripcion}</p>}
      </div>
      {accion && <div className="flex shrink-0 items-center gap-2">{accion}</div>}
    </div>
  );
}

export function TarjetaCuerpo({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/** Tarjeta entera que lleva a otra pantalla: icono, título, frase y la flecha (o la ruedecita). */
export function TarjetaEnlace({
  href,
  titulo,
  descripcion,
  icono,
  extra,
  className,
}: {
  href: string;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: React.ReactNode;
  /** Lo que va antes de la flecha: una cifra, un `Estado`… */
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        claseTarjeta,
        'group flex min-h-16 items-center gap-3 p-4 transition-colors hover:border-zinc-300 active:bg-zinc-50 dark:hover:border-zinc-700 dark:active:bg-zinc-800/60',
        className,
      )}
    >
      {icono && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 [&_svg]:size-5">
          {icono}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</span>
        {descripcion && <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{descripcion}</span>}
      </span>
      {extra}
      <NavPending />
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500"
      />
    </Link>
  );
}
