import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el historial de sincronizaciones…">
      <div className="space-y-4">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-8 w-72" />
        <SkeletonRows n={6} />
      </div>
    </SkeletonPage>
  );
}
