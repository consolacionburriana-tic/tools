import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonPage } from '@/components/ui/skeleton';

// El panel: filtros de periodo, las cuatro cifras, la tendencia y la rejilla de gráficos.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el panel de Puntualidad">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <SkeletonKpis />
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-48 w-full rounded-xl" />
        </SkeletonCard>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-4 h-44 w-full rounded-xl" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
