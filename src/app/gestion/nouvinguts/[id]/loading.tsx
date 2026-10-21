import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la ficha">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} className="h-16" />
          ))}
        </div>
        <SkeletonCard className="h-56" />
      </div>
    </SkeletonPage>
  );
}
