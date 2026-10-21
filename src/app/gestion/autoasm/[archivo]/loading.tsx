import { Skeleton, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el fichero">
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full max-w-3xl rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <SkeletonTabla n={10} columnas={6} />
      </div>
    </SkeletonPage>
  );
}
