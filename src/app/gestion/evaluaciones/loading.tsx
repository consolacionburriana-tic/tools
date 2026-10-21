import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// La cabecera la pone el layout: aquí, los filtros de curso y las tarjetas del listado.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las evaluaciones…">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-10 w-24 rounded-xl" />
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </div>
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
            </SkeletonCard>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
