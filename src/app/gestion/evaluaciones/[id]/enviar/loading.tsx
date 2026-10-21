import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';

// Enviar: la vuelta y el título, los sectores, y las tarjetas de destinatarios y correo.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el envío…">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-16" />
          <Skeleton className="mt-2 h-8 w-72 max-w-full" />
        </div>
        <SkeletonCard>
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-48" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-11 w-full rounded-xl" />
          <Skeleton className="mt-4 h-4 w-20" />
          <Skeleton className="mt-2 h-48 w-full rounded-xl" />
        </SkeletonCard>
        <Skeleton className="h-11 w-48 rounded-xl" />
      </div>
    </SkeletonPage>
  );
}
