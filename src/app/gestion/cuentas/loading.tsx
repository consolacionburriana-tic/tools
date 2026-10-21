import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// La forma de «Por hacer», que es lo que se abre: las vistas, las tres cifras y las tareas.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las cuentas de Google">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
          <Skeleton className="h-10 w-56 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2.5 h-7 w-20" />
            </SkeletonCard>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-10 w-36 rounded-xl" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
