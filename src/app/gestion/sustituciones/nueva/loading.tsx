import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Preparando la ausencia">
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
