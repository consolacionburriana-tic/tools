import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El login comprueba la sesión en servidor, así que también tiene su viaje de ida
// y vuelta. Sin esto heredaba el esqueleto del escritorio (cabecera + tarjetas),
// que no se parece a esta pantalla centrada.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <SkeletonPage label="Cargando el acceso…">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            <Skeleton className="h-[90px] w-[170px] rounded-2xl" />
            <Skeleton className="mt-4 h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-52" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="mx-auto mt-3 h-3 w-64" />
          </div>
        </div>
      </SkeletonPage>
    </div>
  );
}
