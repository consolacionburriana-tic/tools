import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Retrasos: filtros de periodo con el CSV y la lista agrupada por días.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando los retrasos">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-40" />
        <SkeletonRows n={6} />
      </div>
    </SkeletonPage>
  );
}
