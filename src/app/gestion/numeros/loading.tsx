import { Skeleton, SkeletonCard, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los números del cole">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-12 w-72 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} className="p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-7 w-14" />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonTabla n={10} columnas={6} />
      </div>
    </SkeletonPage>
  );
}
