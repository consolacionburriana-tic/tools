import Link from 'next/link';
import { cn } from '@/lib/utils';
import { claseTarjeta } from '@/components/ui/tarjeta';

// Una cifra con su nombre: «Pedidos · 214 · 12 sin pagar». Van en fila dentro de `Cifras`
// (dos columnas en el móvil, cuatro desde el iPad). La barra, si va, dice qué parte del
// total es (0 a 1); el punto, de qué categoría es (una clase `bg-*`). El tono pinta la cifra
// cuando es un estado que hay que ver de un vistazo: «Faltan 109» en ámbar, «0 pendientes»
// en verde. Solo cuando ayuda a decidir algo; una cifra neutra se queda en negro.

const TONO_VALOR = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  aviso: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
} as const;
const TONO_BARRA = {
  ok: 'bg-emerald-500',
  aviso: 'bg-amber-500',
  error: 'bg-red-500',
} as const;

export function Cifras({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>;
}

export function Cifra({
  etiqueta,
  valor,
  nota,
  icono,
  punto,
  barra,
  tono,
  href,
  className,
}: {
  etiqueta: React.ReactNode;
  valor: React.ReactNode;
  nota?: React.ReactNode;
  icono?: React.ReactNode;
  punto?: string;
  barra?: number;
  tono?: keyof typeof TONO_VALOR;
  href?: string;
  className?: string;
}) {
  const contenido = (
    <>
      <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 [&_svg]:size-4 [&_svg]:shrink-0">
        {punto && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', punto)} />}
        {icono}
        <span className="min-w-0 truncate">{etiqueta}</span>
      </span>
      <span
        className={cn(
          'mt-1 block text-2xl font-semibold tracking-tight tabular-nums',
          tono ? TONO_VALOR[tono] : 'text-zinc-900 dark:text-zinc-100',
        )}
      >
        {valor}
      </span>
      {nota && <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{nota}</span>}
      {barra !== undefined && (
        <span aria-hidden className="mt-3 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-500',
              punto ?? (tono ? TONO_BARRA[tono] : barra >= 1 ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500'),
            )}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, barra)) * 100)}%` }}
          />
        </span>
      )}
    </>
  );
  const clases = cn(claseTarjeta, 'block min-w-0 p-4', className);
  if (href) {
    return (
      <Link href={href} className={cn(clases, 'transition-colors hover:border-zinc-300 dark:hover:border-zinc-700')}>
        {contenido}
      </Link>
    );
  }
  return <div className={clases}>{contenido}</div>;
}
