import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import { Skeleton, SkeletonPage, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando las descargas">
      <SubpantallaCargando ancho="estrecho">
        <Skeleton className="mb-3 h-16 w-full rounded-xl" />
        <SkeletonRows n={6} />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
