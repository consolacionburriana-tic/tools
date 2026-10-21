import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import {
  Skeleton,
  SkeletonCard,
  SkeletonPage,
  SkeletonRows,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el pedido">
      <SubpantallaCargando ancho="estrecho">
        <SkeletonCard className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </SkeletonCard>
        <SkeletonRows n={4} className="mt-4" />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
