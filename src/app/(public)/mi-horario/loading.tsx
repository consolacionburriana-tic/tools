import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';
import { EsqueletoRejilla } from '@/components/horarios/esqueleto';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando tu horario">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-12 w-80 max-w-full rounded-2xl" />
        <EsqueletoRejilla />
        <SkeletonCard>
          <Skeleton className="h-4 w-52" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
