import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonPage } from '@/components/ui/skeleton';

// El layout de licencias es solo un guard de auth (devuelve children), así que el
// esqueleto tiene que pintar también la cabecera de la página.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>

      <SkeletonPage label="Cargando el panel de licencias…">
        <main className="mx-auto max-w-3xl px-4 py-6">
          <SkeletonKpis />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} className="flex items-center gap-2 px-4 py-3">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-4 w-32" />
              </SkeletonCard>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="bg-zinc-50 px-4 py-2.5 dark:bg-zinc-800/50">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </SkeletonPage>
    </div>
  );
}
