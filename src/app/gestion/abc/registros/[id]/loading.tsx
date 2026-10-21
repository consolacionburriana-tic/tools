import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonPage } from '@/components/ui/skeleton';

// Un registro: volver, siglas y fecha, las cuatro cifras y las tarjetas del análisis.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el registro">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <SkeletonKpis />
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-7 w-28 rounded-md" />
            ))}
          </div>
        </SkeletonCard>
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="h-36" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
