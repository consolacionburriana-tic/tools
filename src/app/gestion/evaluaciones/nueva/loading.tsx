import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// Nueva evaluación: la vuelta y el título, y el formulario por pasos.
export default function Loading() {
  return (
    <SkeletonPage label="Preparando la nueva evaluación…">
      <Skeleton className="h-10 w-52 rounded-xl" />
      <Skeleton className="mt-2 h-4 w-20" />
      <Skeleton className="mt-2 mb-5 h-8 w-56" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
