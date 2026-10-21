import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el importador">
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <SkeletonCard className="flex h-44 flex-col items-center justify-center gap-3">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-4 w-56" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
