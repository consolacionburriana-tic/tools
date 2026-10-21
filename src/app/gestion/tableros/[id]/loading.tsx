import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// Un tablero: volver, su nombre, los filtros y las columnas.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el tablero">
      <div className="space-y-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-9 w-64" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-64 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
