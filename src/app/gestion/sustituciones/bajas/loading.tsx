import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las bajas">
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <Skeleton className="h-10 w-80 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <SkeletonRows n={4} />
      </div>
    </SkeletonPage>
  );
}
