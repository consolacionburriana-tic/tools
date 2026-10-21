'use client';

// Casillas de verdad (no botones que lo parecen), con la zona táctil de 40 px que pide la guía.
// `Casilla` lleva su texto al lado; `CasillaFila` es la de elegir una fila de la lista, sin
// texto a la vista (lo lleva para el lector de pantalla).
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

const CAJA =
  'size-5 shrink-0 cursor-pointer rounded accent-blue-600 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default';

export function Casilla({
  marcada,
  onCambio,
  disabled,
  detalle,
  className,
  children,
}: {
  marcada: boolean;
  onCambio: (marcada: boolean) => void;
  disabled?: boolean;
  /** Una frase gris debajo del texto. */
  detalle?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex min-h-10 cursor-pointer items-start gap-3 py-2 text-sm text-zinc-800 has-disabled:cursor-default has-disabled:opacity-60 dark:text-zinc-200',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={marcada}
        disabled={disabled}
        onChange={(e) => {
          haptic.tap();
          onCambio(e.target.checked);
        }}
        className={cn(CAJA, 'mt-px')}
      />
      <span className="min-w-0">
        <span className="block">{children}</span>
        {detalle && <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{detalle}</span>}
      </span>
    </label>
  );
}

export function CasillaFila({
  marcada,
  onCambio,
  etiqueta,
  disabled,
  className,
}: {
  marcada: boolean;
  onCambio: () => void;
  /** Para el lector de pantalla: «Elegir Matemáticas 3º ESO». */
  etiqueta: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        '-m-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-zinc-100 has-disabled:cursor-default has-disabled:opacity-50 has-disabled:hover:bg-transparent dark:hover:bg-zinc-800',
        className,
      )}
    >
      <input type="checkbox" checked={marcada} disabled={disabled} onChange={onCambio} className={CAJA} />
      <span className="sr-only">{etiqueta}</span>
    </label>
  );
}
