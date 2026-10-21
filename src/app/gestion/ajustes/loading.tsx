import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los ajustes del colegio">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-6 w-40 rounded-full" />
          ))}
        </div>
        <SkeletonCard className="h-72" />
        <SkeletonRows n={4} />
      </div>
    </SkeletonPage>
  );
}
