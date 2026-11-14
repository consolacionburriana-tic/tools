import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las plantillas">
      <div className="space-y-5">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-full max-w-xl rounded-full" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
