import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonPage } from '@/components/ui/skeleton';

// Resultados: la vuelta y el título con sus acciones, las cifras y un bloque por actividad.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando los resultados…">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-10 w-44 rounded-xl" />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-72 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40 rounded-xl" />
              <Skeleton className="h-10 w-20 rounded-xl" />
            </div>
          </div>
        </div>
        <SkeletonKpis />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-56" />
            {Array.from({ length: 4 }).map((__, j) => (
              <Skeleton key={j} className="mt-3 h-3 w-full rounded-full" />
            ))}
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
