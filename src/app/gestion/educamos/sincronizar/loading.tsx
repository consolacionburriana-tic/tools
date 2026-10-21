import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la sincronización…">
      <div className="space-y-4">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-72 rounded-xl" />
        <SkeletonCard className="h-48" />
      </div>
    </SkeletonPage>
  );
}
