import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El formulario no cuelga del layout de /gestion: la cabecera la pone él mismo, así que el
// esqueleto también, con los tres pasos (buscador, asignaturas, hora) debajo.
export default function Loading() {
  return (
    <PaginaModulo modulo="puntualidad" ancho="estrecho">
      <SkeletonPage label="Cargando el registro de retrasos">
        <div className="space-y-8">
          <Skeleton className="h-4 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="flex flex-wrap gap-2">
              {['w-36', 'w-28', 'w-40', 'w-24', 'w-32', 'w-28'].map((w, i) => (
                <Skeleton key={i} className={`h-12 rounded-full ${w}`} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-12 w-40 rounded-xl" />
              <Skeleton className="h-12 w-52 rounded-xl" />
              <Skeleton className="h-12 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </SkeletonPage>
    </PaginaModulo>
  );
}
