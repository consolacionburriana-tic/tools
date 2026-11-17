import { Skeleton, SkeletonKpis, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los números">
      <div className="space-y-5">
        <Skeleton className="h-10 w-80 rounded-full" />
        <SkeletonKpis n={4} />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
