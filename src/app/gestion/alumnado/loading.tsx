import { Skeleton, SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// La forma del panel: el carril de clases, las vistas y, debajo, la lista y la ficha.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el alumnado">
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <SkeletonCard className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-16 rounded-lg" />
          ))}
        </SkeletonCard>
        <Skeleton className="h-12 w-full max-w-3xl rounded-2xl" />
        <div className="lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-5">
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-xl" />
            <SkeletonRows n={6} />
          </div>
          <SkeletonCard className="mt-3 hidden h-72 lg:mt-0 lg:block" />
        </div>
      </div>
    </SkeletonPage>
  );
}
