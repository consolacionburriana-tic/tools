import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// El layout de usuarios es solo un guard de auth: el esqueleto pinta la cabecera.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1.5 h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>

      <SkeletonPage label="Cargando usuarios y roles…">
        <main className="mx-auto max-w-4xl space-y-3 px-4 py-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="mt-2 h-3 w-64" />
              </div>
              <Skeleton className="h-8 w-28 shrink-0 rounded-lg" />
            </SkeletonCard>
          ))}
        </main>
      </SkeletonPage>
    </div>
  );
}
