import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import {
  SkeletonKpis,
  SkeletonPage,
  SkeletonTabla,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando la gestión económica">
      <SubpantallaCargando ancho="medio">
        <SkeletonKpis n={3} />
        <div className="mt-6">
          <SkeletonTabla n={6} columnas={4} />
        </div>
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
