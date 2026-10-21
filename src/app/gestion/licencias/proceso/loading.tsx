import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import { SkeletonPage, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el esquema del proceso">
      <SubpantallaCargando ancho="estrecho">
        <SkeletonRows n={5} />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
