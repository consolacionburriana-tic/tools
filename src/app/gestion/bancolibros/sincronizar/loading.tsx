import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la sincronización">
      <Skeleton className="h-10 w-36 rounded-xl" />
      <Skeleton className="mt-2 mb-5 h-8 w-48" />
      <SkeletonCard>
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-5/6" />
        <Skeleton className="mt-5 h-11 w-40 rounded-xl" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
