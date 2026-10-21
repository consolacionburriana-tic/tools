import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// La encuesta lee su formulario del servidor: sin esto, quien toca el enlace se queda
// mirando una pantalla en blanco. Fondo neutro porque aún no se sabe el color de la encuesta.
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Skeleton className="h-[125px] w-[250px] rounded-2xl" />
          <Skeleton className="mt-5 h-6 w-64" />
        </div>
        <SkeletonPage label="Cargando la encuesta…">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <Skeleton className="h-5 w-56" />
                <div className="mt-4 flex gap-2">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-11 flex-1 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SkeletonPage>
      </main>
    </div>
  );
}
