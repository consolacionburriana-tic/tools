import { SkeletonKpis, SkeletonPage, SkeletonRows } from '@/components/ui/skeleton';

// El layout del ABC ya pinta cabecera y <main>: aquí solo va el contenido.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el panel del Registro ABC…">
      <div className="space-y-5">
        <SkeletonKpis />
        <SkeletonRows n={6} />
      </div>
    </SkeletonPage>
  );
}
