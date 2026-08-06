import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// El layout de educamos es solo un guard de auth: el esqueleto pinta la cabecera.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-1.5 h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>

      <SkeletonPage label="Cargando la BBDD central…">
        <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2.5 h-7 w-12" />
              </SkeletonCard>
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 shrink-0 rounded" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="ml-auto h-4 w-4 shrink-0 rounded" />
            </SkeletonCard>
          ))}
        </main>
      </SkeletonPage>
    </div>
  );
}
