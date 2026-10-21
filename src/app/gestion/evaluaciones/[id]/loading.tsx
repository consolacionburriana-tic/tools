import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// El editor de una evaluación: la vuelta, la tarjeta del título y ajustes, y las preguntas.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando la evaluación…">
      <Skeleton className="h-10 w-52 rounded-xl" />
      <div className="mt-2 space-y-4">
        <SkeletonCard>
          <Skeleton className="h-7 w-80 max-w-full" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-xl" />
            ))}
          </div>
        </SkeletonCard>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
