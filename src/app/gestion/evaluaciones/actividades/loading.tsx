import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// Actividades: la vuelta y el título, los filtros por categoría y la lista.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las actividades…">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-10 w-52 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-20" />
          <Skeleton className="mt-2 h-8 w-40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-64 max-w-full" />
            <Skeleton className="mt-2 h-4 w-48" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
