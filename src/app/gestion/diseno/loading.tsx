import { SkeletonCard, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las piezas">
      <SkeletonCard className="h-24" />
      <SkeletonRows n={4} className="mt-4" />
    </SkeletonPage>
  );
}
