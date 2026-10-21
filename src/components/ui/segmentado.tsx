'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

// El segmentado de la app, como el del iPad: pista gris y la opción activa en blanco.
// Sirve para cambiar de VISTA (Lista / Por clase / Cuotas). Para FILTRAR una lista, `Filtro`
// (pastillas, la activa en negro). Hasta cinco opciones; con más, la pista se desplaza.

const PISTA =
  'max-w-full gap-1 overflow-x-auto rounded-2xl bg-zinc-200/60 p-1 [scrollbar-width:none] dark:bg-zinc-800/80 [&::-webkit-scrollbar]:hidden';
const SEGMENTO =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0';
const ACTIVO = 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100';
const INACTIVO = 'font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

export interface OpcionSegmentado<T extends string> {
  valor: T;
  etiqueta: React.ReactNode;
  icono?: React.ReactNode;
  /** Un número al lado (cuántos hay en esa vista). */
  cuenta?: number;
}

function Cuenta({ n }: { n: number }) {
  return <span className="font-mono text-xs tabular-nums opacity-70">{n}</span>;
}

/**
 * Vistas de una misma pantalla, con estado local. `etiqueta` es para el lector de pantalla
 * («Ver por»). Con `lleno`, las opciones se reparten todo el ancho.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  lleno = false,
  className,
}: {
  opciones: readonly OpcionSegmentado<T>[];
  valor: T;
  onChange: (valor: T) => void;
  etiqueta: string;
  lleno?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn(PISTA, lleno ? 'flex w-full' : 'inline-flex', className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              if (activo) return;
              haptic.tap();
              onChange(o.valor);
            }}
            className={cn(SEGMENTO, lleno && 'flex-1', activo ? ACTIVO : INACTIVO)}
          >
            {o.icono}
            {o.etiqueta}
            {o.cuenta !== undefined && <Cuenta n={o.cuenta} />}
          </button>
        );
      })}
    </div>
  );
}

export interface Seccion {
  href: string;
  etiqueta: string;
  icono?: React.ReactNode;
  cuenta?: number;
}

/** El icono de la sección, o la ruedecita mientras su página carga (la caja no cambia). */
function IconoOCarga({ icono }: { icono?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 aria-hidden className="animate-spin" />;
  return icono ?? null;
}

/**
 * Las secciones de un módulo cuando cada una es una ruta (ABC: Panel, Registros, Alumnos).
 * Va en el layout del módulo, así que no se mueve al cambiar de sección. La activa se saca de
 * la URL; la portada del módulo solo cuenta como activa cuando se está justo en ella.
 */
export function Secciones({
  secciones,
  etiqueta = 'Secciones del módulo',
  className,
}: {
  secciones: readonly Seccion[];
  etiqueta?: string;
  className?: string;
}) {
  const ruta = usePathname();
  const activa = (s: Seccion) => {
    const portada = secciones.some((o) => o !== s && o.href.startsWith(`${s.href}/`));
    return ruta === s.href || (!portada && ruta.startsWith(`${s.href}/`));
  };
  return (
    <nav aria-label={etiqueta} className={cn(PISTA, 'inline-flex', className)}>
      {secciones.map((s) => {
        const es = activa(s);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={es ? 'page' : undefined}
            className={cn(SEGMENTO, es ? ACTIVO : INACTIVO)}
          >
            <IconoOCarga icono={s.icono} />
            {s.etiqueta}
            {s.cuenta !== undefined && <Cuenta n={s.cuenta} />}
          </Link>
        );
      })}
    </nav>
  );
}
