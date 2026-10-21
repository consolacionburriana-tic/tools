import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el cuaderno de tutor">
      <div className="space-y-4">
        <SkeletonCard className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </SkeletonCard>
        <Skeleton className="h-12 w-full max-w-2xl rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-28 rounded-full" />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
