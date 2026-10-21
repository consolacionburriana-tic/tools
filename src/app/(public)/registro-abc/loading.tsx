import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El formulario que más se abre a diario (profesorado, iPad) y hace 3 consultas antes de
// pintar. No cuelga del layout de /gestion: la cabecera la pone él mismo, así que el
// esqueleto también, con sus secciones «título + pastillas» debajo.
export default function Loading() {
  const secciones = [4, 3, 6, 5, 4, 7]; // nº de pastillas por sección, como el form real
  return (
    <PaginaModulo modulo="abc" ancho="estrecho">
      <SkeletonPage label="Cargando el registro ABC">
        <div className="space-y-8">
          <Skeleton className="h-4 w-64" />
          {secciones.map((chips, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: chips }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-24 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SkeletonPage>
    </PaginaModulo>
  );
}
