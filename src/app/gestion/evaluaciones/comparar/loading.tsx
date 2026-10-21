import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Comparar: la vuelta y el título, las series con varias ediciones y el ranking del curso.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las comparativas…">
      <div className="space-y-5">
        <div>
          <Skeleton className="h-10 w-52 rounded-xl" />
          <Skeleton className="mt-2 h-8 w-36" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-72 max-w-full" />
          {[0, 1].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-3 w-32" />
            </SkeletonCard>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-5 w-64" />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <SkeletonRows n={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}
