import { cn } from '@/lib/utils';

/**
 * El rótulo pequeño en mayúsculas que encabeza un grupo («AHORA», «TU DÍA», «RESUMEN»).
 * Es un encabezado de verdad (h2 por defecto) para que el lector de pantalla pueda saltar.
 */
export function Rotulo({
  as: Etiqueta = 'h2',
  id,
  accion,
  className,
  children,
}: {
  as?: 'h2' | 'h3' | 'p';
  id?: string;
  accion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const rotulo = (
    <Etiqueta
      id={id}
      className={cn('text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400', !accion && className)}
    >
      {children}
    </Etiqueta>
  );
  if (!accion) return rotulo;
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {rotulo}
      {accion}
    </div>
  );
}
