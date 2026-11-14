import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la disponibilidad">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <Skeleton className="h-11 w-72 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
