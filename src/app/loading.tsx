import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// La portada pasó a server component (lee el curso de la campaña activa), así que
// también hace un viaje al servidor: este esqueleto evita el fogonazo en blanco.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-12">
        <SkeletonPage label="Cargando…">
          <div className="flex flex-col items-center">
            <Skeleton className="h-[130px] w-[260px] rounded-3xl" />
            <Skeleton className="mt-6 h-7 w-52" />
            <Skeleton className="mt-2 h-4 w-72" />
            <div className="mt-8 w-full space-y-3">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </SkeletonPage>
      </main>
    </div>
  );
}
