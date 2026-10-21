import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import {
  Skeleton,
  SkeletonPage,
  SkeletonTabla,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando los pedidos">
      <SubpantallaCargando ancho="completo">
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <SkeletonTabla n={8} columnas={6} />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
