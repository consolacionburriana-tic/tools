import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las salidas">
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-2xl rounded-xl" />
        <SkeletonRows n={4} />
      </div>
    </SkeletonPage>
  );
}
