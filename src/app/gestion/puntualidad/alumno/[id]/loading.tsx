import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// La ficha de un alumno: volver, su nombre, las tres tarjetas de reparto y el historial.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando la ficha del alumno">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-3 h-3 w-2/3" />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonRows n={4} />
      </div>
    </SkeletonPage>
  );
}
