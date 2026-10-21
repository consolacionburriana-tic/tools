import { Skeleton, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Preparando la ficha">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-11 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full" />
        <SkeletonTabla n={10} columnas={6} />
      </div>
    </SkeletonPage>
  );
}
