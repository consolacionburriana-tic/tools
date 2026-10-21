import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Cargando() {
  return (
    <SkeletonPage label="Cargando los oratorios">
      <div className="space-y-4">
        <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-[30rem] rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
