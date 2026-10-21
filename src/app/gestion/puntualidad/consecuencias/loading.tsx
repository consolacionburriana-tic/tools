import { Skeleton, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// Consecuencias: las que esperan fecha y las puestas.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando las consecuencias">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <SkeletonRows n={2} />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <SkeletonRows n={4} />
        </div>
      </div>
    </SkeletonPage>
  );
}
