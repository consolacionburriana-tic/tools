import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// La cabecera la pone el layout: aquí, los filtros y las tarjetas de las salidas.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las salidas">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-2 h-3 w-64" />
                </div>
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
              <Skeleton className="mt-2 h-3 w-56" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
