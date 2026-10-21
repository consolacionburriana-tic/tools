import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import {
  Skeleton,
  SkeletonPage,
  SkeletonTabla,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando el envío de licencias">
      <SubpantallaCargando ancho="completo">
        <Skeleton className="mb-4 h-12 w-80 max-w-full rounded-2xl" />
        <SkeletonTabla n={8} columnas={6} />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
