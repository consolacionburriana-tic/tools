import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// Esqueleto del escritorio. Además de cubrir /gestion, hace de red para cualquier
// sección anidada que no tenga su propio loading.tsx: al pulsar, la pantalla
// responde al instante en vez de quedarse en la página anterior.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </header>

      <SkeletonPage label="Cargando el escritorio…">
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-7 w-12" />
              </SkeletonCard>
            ))}
          </section>

          <section className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} className="flex items-start gap-3">
                <Skeleton className="mt-0.5 h-6 w-6 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="mt-2 h-3 w-full max-w-sm" />
                </div>
              </SkeletonCard>
            ))}
          </section>
        </main>
      </SkeletonPage>
    </div>
  );
}
