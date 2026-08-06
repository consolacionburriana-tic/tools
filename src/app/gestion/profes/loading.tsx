import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// El layout de profes es solo un guard de auth: el esqueleto pinta la cabecera.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-72" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>

      <SkeletonPage label="Cargando las tutorías…">
        <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-4 w-20" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            </SkeletonCard>
          ))}
        </main>
      </SkeletonPage>
    </div>
  );
}
