import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El layout de bancolibros ya pinta cabecera y <main>. El panel abre con el
// selector de clases agrupado por etapa, así que el esqueleto imita esas filas de
// pastillas para que no dé un salto al llegar los datos.
export default function Loading() {
  return (
    <SkeletonPage label="Cargando el banco de libros…">
      <div className="space-y-2.5">
        {Array.from({ length: 2 }).map((_, etapa) => (
          <div key={etapa}>
            <Skeleton className="mb-1.5 ml-0.5 h-3 w-24" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: etapa === 0 ? 8 : 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-16 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
