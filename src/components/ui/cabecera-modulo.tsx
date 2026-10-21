import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODULOS, type ClaveModulo } from '@/lib/modulos';
import { buttonVariants } from '@/components/ui/button';
import { IconoModulo } from '@/components/ui/icono-modulo';
import { ANCHO_PAGINA, type AnchoPagina } from '@/components/ui/ancho';
import { Secciones, type Seccion } from '@/components/ui/segmentado';

// La cabecera común de los módulos de /gestion y la página que la envuelve. Una sola barra
// para toda la app: icono del módulo (con el color de su grupo), su nombre, la acción que
// más se usa y la vuelta al escritorio. Las secciones del módulo van debajo, en un
// segmentado de enlaces que no se mueve al cambiar de una a otra.
//
// Las páginas no repiten el nombre del módulo en un título grande: empiezan por lo suyo
// (filtros, datos). Cada página pone su `<h1 className="sr-only">` para el lector de
// pantalla, salvo las de una cosa concreta (la ficha de un alumno, un tablero), que llevan
// su nombre a la vista con `TituloPagina`.

export function CabeceraModulo({
  modulo,
  titulo,
  accion,
  aviso,
  ancho = 'normal',
}: {
  modulo: ClaveModulo;
  /** Otro nombre para la cabecera, si el del registro no vale aquí. */
  titulo?: string;
  /** La acción principal del módulo (un botón o enlace `size="sm"`). Una, como mucho dos. */
  accion?: React.ReactNode;
  /** Una franja informativa bajo la barra («Ves solo tus clases»). */
  aviso?: React.ReactNode;
  ancho?: AnchoPagina;
}) {
  const m = MODULOS[modulo];
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 print:hidden">
      <div className={cn('mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6', ANCHO_PAGINA[ancho])}>
        <Link
          href={m.href}
          className="-ml-1 flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 text-base font-semibold text-zinc-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-100"
        >
          <IconoModulo icono={m.icono} grupo={m.grupo} tamano="sm" />
          <span className="truncate">{titulo ?? m.titulo}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {accion}
          <Link href="/gestion" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'px-3' })}>
            <ChevronLeft aria-hidden />
            <span className="sr-only sm:not-sr-only">Escritorio</span>
          </Link>
        </div>
      </div>
      {aviso && (
        <div className="border-t border-blue-100 bg-blue-50 px-4 py-2 text-center text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
          {aviso}
        </div>
      )}
    </header>
  );
}

/**
 * Lo que devuelve el layout de un módulo: fondo, cabecera, secciones y el contenido con el
 * ancho del módulo. Uno por módulo (no por pantalla) para que nada salte al navegar.
 */
export function PaginaModulo({
  modulo,
  titulo,
  accion,
  aviso,
  secciones,
  ancho = 'normal',
  children,
}: {
  modulo: ClaveModulo;
  titulo?: string;
  accion?: React.ReactNode;
  aviso?: React.ReactNode;
  secciones?: readonly Seccion[];
  ancho?: AnchoPagina;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 print:min-h-0 print:bg-white">
      <CabeceraModulo modulo={modulo} titulo={titulo} accion={accion} aviso={aviso} ancho={ancho} />
      <main className={cn('mx-auto w-full px-4 pt-5 pb-20 sm:px-6 print:max-w-none print:p-0', ANCHO_PAGINA[ancho])}>
        {secciones && secciones.length > 1 && <Secciones secciones={secciones} className="mb-5 print:hidden" />}
        {children}
      </main>
    </div>
  );
}

/** «‹ Todos los nouvinguts»: la vuelta a la lista desde la página de una cosa, encima de su título. */
export function EnlaceVolver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-3 px-3 text-zinc-600 dark:text-zinc-400' })}>
      <ChevronLeft aria-hidden />
      {children}
    </Link>
  );
}

/**
 * El nombre de lo que se está viendo cuando la página es de una cosa concreta: la ficha de
 * un alumno, un tablero, una salida. Con su frase y sus acciones a la derecha.
 */
export function TituloPagina({
  descripcion,
  acciones,
  antes,
  className,
  children,
}: {
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  /** Lo que va encima del título, pequeño (la clase, la fecha, «← Todas las salidas»). */
  antes?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
      <div className="min-w-0">
        {antes && <div className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">{antes}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{children}</h1>
        {descripcion && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
