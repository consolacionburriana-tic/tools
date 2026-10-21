import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';
import { EsqueletoRejilla } from '@/components/horarios/esqueleto';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el horario">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-12 w-full max-w-sm rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
          ))}
        </div>
        <EsqueletoRejilla />
      </div>
    </SkeletonPage>
  );
}
