import { SubpantallaCargando } from "@/components/licencias/subpantalla";
import { Skeleton, SkeletonPage, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Cargando quién falta">
      <SubpantallaCargando ancho="medio">
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <SkeletonRows n={6} />
      </SubpantallaCargando>
    </SkeletonPage>
  );
}
