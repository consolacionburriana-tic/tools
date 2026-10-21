import { cn } from '@/lib/utils';

/**
 * Bloque gris que late mientras carga. La clase `.skeleton` (globals.css) ya trae
 * el color y la animación, y respeta `prefers-reduced-motion`.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/**
 * Tarjeta-esqueleto con el mismo contorno que las tarjetas reales del repo
 * (rounded-2xl + borde zinc), para que al llegar el contenido no dé un salto.
 */
export function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  );
}

/** Rejilla de KPIs (los paneles de licencias/abc abren con 4 números arriba). */
export function SkeletonKpis({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2.5 h-7 w-14" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Lista de filas tipo "tarjeta con título y subtítulo" (salidas, pedidos, alumnado). */
export function SkeletonRows({ n = 5, className }: { n?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/**
 * Envoltorio de página que carga. `label` se anuncia a lectores de pantalla
 * (`role="status"`) para que la espera no sea solo visual.
 */
export function SkeletonPage({ label, children }: { label: string; children: React.ReactNode }) {
  // OJO: nada de `anim-up` aquí. El esqueleto ES el feedback instantáneo; si se
  // desvaneciera hacia dentro (0.45s desde opacidad 0) los primeros milisegundos
  // seguirían en blanco, que es justo el problema que viene a resolver.
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Tabla: la fila de cabecera y `n` filas, dentro de una tarjeta (Licencias, Correos, AUTOASM). */
export function SkeletonTabla({ n = 8, columnas = 5 }: { n?: number; columnas?: number }) {
  return (
    <SkeletonCard className="overflow-hidden p-0">
      <div className="flex gap-4 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        {Array.from({ length: columnas }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columnas }).map((_, j) => (
              <Skeleton key={j} className={cn('h-4 flex-1', j === 0 && 'flex-[2]')} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
