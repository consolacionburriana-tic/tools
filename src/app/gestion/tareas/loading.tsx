import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// El alta a la izquierda y, a la derecha, las vistas, los filtros y la lista.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las tareas">
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <SkeletonCard className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </SkeletonCard>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-12 w-64 rounded-2xl" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <SkeletonRows n={5} />
        </div>
      </div>
    </SkeletonPage>
  );
}
