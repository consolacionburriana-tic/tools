import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// La portada: la frase, «Lo tuyo» y las baldosas de un equipo.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando los tableros">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
        <SkeletonCard className="h-40" />
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
