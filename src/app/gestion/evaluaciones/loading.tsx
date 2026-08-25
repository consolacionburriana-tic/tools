import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// El layout de evaluaciones ya pinta cabecera y <main>: aquí solo el listado.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las evaluaciones…">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="mt-2 h-3 w-72" />
              </div>
              <Skeleton className="h-5 w-5 shrink-0 rounded" />
            </div>
            {/* Barra de participación */}
            <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
