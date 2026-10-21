import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando AUTOASM">
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-52" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
