import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** La rejilla mientras llega: la columna de hora y las cinco de los días. */
export function EsqueletoRejilla({ filas = 7 }: { filas?: number }) {
  return (
    <SkeletonCard className="overflow-hidden p-0">
      <div className="flex gap-2 border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <Skeleton className="h-3 w-12 shrink-0" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex gap-2 px-3 py-2">
            <Skeleton className="h-10 w-12 shrink-0" />
            {[0, 1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-10 flex-1 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
