import { Skeleton, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los nouvinguts">
      <div className="space-y-5">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <SkeletonTabla n={6} columnas={4} />
      </div>
    </SkeletonPage>
  );
}
