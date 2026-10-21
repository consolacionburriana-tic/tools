import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando usuarios y roles…">
      <div className="space-y-3">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-11 w-full rounded-xl" />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
            <Skeleton className="h-10 w-40 shrink-0 rounded-full" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
