import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el historial">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-48 rounded-xl" />
          <Skeleton className="h-11 w-56 rounded-xl" />
        </div>
        <SkeletonRows n={8} />
      </div>
    </SkeletonPage>
  );
}
