import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la semana de sustituciones">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="ml-auto h-10 w-72 rounded-full" />
        </div>
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-[38rem] w-full rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
