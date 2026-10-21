import { SkeletonKpis, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la BBDD central…">
      <div className="space-y-4">
        <SkeletonKpis n={3} />
        <SkeletonRows n={3} />
      </div>
    </SkeletonPage>
  );
}
