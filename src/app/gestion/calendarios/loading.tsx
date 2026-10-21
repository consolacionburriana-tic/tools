import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el inventario de calendarios">
      <div className="space-y-5">
        <Skeleton className="h-12 w-80 max-w-full rounded-2xl" />
        <SkeletonCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-44 rounded-xl" />
              <Skeleton className="h-10 w-40 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-4 w-3/4" />
        </SkeletonCard>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-full rounded-xl sm:w-60" />
          <Skeleton className="h-11 min-w-48 flex-1 rounded-xl" />
        </div>
        <SkeletonCard className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <Skeleton className="mt-0.5 size-5 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
