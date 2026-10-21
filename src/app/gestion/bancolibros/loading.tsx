import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El panel abre con el resumen y el selector de clases agrupado por etapa: el esqueleto
// imita esas filas de pastillas para que no dé un salto al llegar los datos.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el banco de libros">
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        {Array.from({ length: 2 }).map((_, etapa) => (
          <div key={etapa}>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: etapa === 0 ? 8 : 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
