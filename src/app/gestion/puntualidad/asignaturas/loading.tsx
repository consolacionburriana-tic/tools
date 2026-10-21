import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Asignaturas: volver, título, el campo para añadir y la lista.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las asignaturas">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
        <SkeletonRows n={6} />
      </div>
    </SkeletonPage>
  );
}
