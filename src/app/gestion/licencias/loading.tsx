import {
  Skeleton,
  SkeletonCard,
  SkeletonKpis,
  SkeletonPage,
  SkeletonTabla,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el panel de licencias">
      <div className="space-y-6">
        <SkeletonCard className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </SkeletonCard>
        <SkeletonKpis />
        {[5, 4].map((n, g) => (
          <div key={g}>
            <Skeleton className="mb-2 h-3 w-32" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: n }).map((_, i) => (
                <SkeletonCard
                  key={i}
                  className="flex min-h-16 items-center gap-3"
                >
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-48 max-w-full" />
                  </div>
                </SkeletonCard>
              ))}
            </div>
          </div>
        ))}
        <SkeletonTabla n={6} columnas={5} />
      </div>
    </SkeletonPage>
  );
}
