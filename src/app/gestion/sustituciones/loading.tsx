import { Skeleton, SkeletonKpis, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las sustituciones del día">
      <div className="space-y-5">
        <Skeleton className="h-11 w-72 rounded-xl" />
        <SkeletonKpis n={3} />
        <SkeletonRows n={6} />
      </div>
    </SkeletonPage>
  );
}
