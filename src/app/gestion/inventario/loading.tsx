import { Skeleton, SkeletonKpis, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el inventario">
      <div className="space-y-5">
        <SkeletonKpis />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-72 rounded-xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <SkeletonTabla n={10} columnas={6} />
      </div>
    </SkeletonPage>
  );
}
