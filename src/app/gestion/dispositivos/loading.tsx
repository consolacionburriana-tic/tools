import { Skeleton, SkeletonPage, SkeletonTabla } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los dispositivos 1:1">
      <div className="space-y-5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-[52px] w-full max-w-xl rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-72 rounded-xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <SkeletonTabla n={8} columnas={5} />
      </div>
    </SkeletonPage>
  );
}
