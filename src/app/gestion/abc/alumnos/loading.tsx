import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Alumnado: la frase con el botón de añadir y la lista de alumnos en seguimiento.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el alumnado del ABC">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
        <SkeletonRows n={4} />
      </div>
    </SkeletonPage>
  );
}
