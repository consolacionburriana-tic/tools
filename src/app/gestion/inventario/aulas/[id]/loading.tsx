import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el aula">
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonRows n={6} />
          <SkeletonRows n={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}
