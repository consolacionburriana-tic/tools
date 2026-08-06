import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// /salidas es force-dynamic: mismo motivo que /licencias, y aquí además suele
// llegarse desde el magic link del correo (?t=…), a menudo con datos móviles.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Skeleton className="h-[125px] w-[250px] rounded-2xl" />
          <Skeleton className="mt-5 h-6 w-44" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <SkeletonPage label="Cargando salidas y pagos…">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-6 h-4 w-72" />
            <Skeleton className="mt-2 h-12 w-full rounded-xl" />
          </div>
        </SkeletonPage>
      </main>
    </div>
  );
}
