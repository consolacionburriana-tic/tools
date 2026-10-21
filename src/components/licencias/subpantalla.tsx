import { cn } from '@/lib/utils';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Skeleton } from '@/components/ui/skeleton';

// El marco de cada pantalla del módulo: «‹ Panel de licencias» encima y su nombre, porque
// Licencias es un índice sin barra de secciones y hace falta saber dónde estás. `estrecho`
// para las pantallas de formulario, que dentro del ancho del módulo se leen mejor recogidas.

export const ANCHO_SUBPANTALLA = {
  completo: '',
  medio: 'max-w-4xl',
  estrecho: 'max-w-3xl',
} as const;

export function Subpantalla({
  titulo,
  descripcion,
  acciones,
  volver = { href: '/gestion/licencias', texto: 'Panel de licencias' },
  ancho = 'completo',
  className,
  children,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  volver?: { href: string; texto: string };
  ancho?: keyof typeof ANCHO_SUBPANTALLA;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(ANCHO_SUBPANTALLA[ancho], className)}>
      <EnlaceVolver href={volver.href}>{volver.texto}</EnlaceVolver>
      <TituloPagina className="mt-1" descripcion={descripcion} acciones={acciones}>
        {titulo}
      </TituloPagina>
      {children}
    </div>
  );
}

/** La parte de arriba de una subpantalla mientras carga: la vuelta y el título. */
export function SubpantallaCargando({
  ancho = 'completo',
  children,
}: {
  ancho?: keyof typeof ANCHO_SUBPANTALLA;
  children: React.ReactNode;
}) {
  return (
    <div className={ANCHO_SUBPANTALLA[ancho]}>
      <Skeleton className="h-10 w-44 rounded-xl" />
      <Skeleton className="mt-2 h-8 w-64" />
      <Skeleton className="mt-2 mb-5 h-4 w-80 max-w-full" />
      {children}
    </div>
  );
}
