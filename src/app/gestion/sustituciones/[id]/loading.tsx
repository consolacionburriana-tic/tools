import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la ausencia">
      <div className="space-y-5">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-5 w-56" />
        <SkeletonRows n={5} />
      </div>
    </SkeletonPage>
  );
}
