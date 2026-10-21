import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// Registros: las dos vistas, los filtros de periodo y el informe con sus gráficos.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando los registros del ABC">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
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
