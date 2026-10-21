import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Esqueletos de las pantallas de una salida (la cabecera la pone el layout).

/** El formulario de crear o editar una salida. */
export function EsqueletoFormularioSalida() {
  return (
    <SkeletonPage label="Cargando el formulario">
      <Skeleton className="h-10 w-40 rounded-xl" />
      <Skeleton className="mt-2 mb-5 h-8 w-56" />
      <SkeletonCard className="max-w-2xl space-y-5 sm:p-5">
        {[0, 1].map((i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-11 w-full rounded-xl" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </SkeletonCard>
    </SkeletonPage>
  );
}

/** El detalle de una salida: título, ficha, recordatorio y el seguimiento. */
export function EsqueletoSalida() {
  return (
    <SkeletonPage label="Cargando la salida">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-10 w-40 rounded-xl" />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <Skeleton className="h-8 w-64" />
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <SkeletonCard>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-3 h-10 w-full rounded-xl" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-5 w-72" />
        </SkeletonCard>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <SkeletonRows n={5} />
      </div>
    </SkeletonPage>
  );
}
