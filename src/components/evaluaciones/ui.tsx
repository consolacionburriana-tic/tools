'use client';

// Piezas propias de Evaluaciones que no existen en `components/ui/` porque solo las usa
// este módulo: el icono de cada colectivo y categoría, la guía de color que enhebra las
// preguntas de una actividad, la tinta legible sobre el color de una actividad y la zona
// plegable del editor. Botones, campos, segmentados y rótulos son los comunes.
import {
  ChevronDown,
  Church,
  GraduationCap,
  Lightbulb,
  School,
  Tag,
  UsersRound,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Rotulo as RotuloComun } from '@/components/ui/rotulo';
import type { Audiencia, Categoria } from '@/lib/evaluaciones';

/**
 * Rótulo de grupo en mayúsculas. Es el común, como párrafo: lo usa también Ajustes del
 * colegio, que lo pinta dentro de un bloque que ya tiene su encabezado.
 */
export function Rotulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <RotuloComun as="p" className={className}>
      {children}
    </RotuloComun>
  );
}

// ─── Iconos de colectivo y de categoría ──────────────────────────────────────

const ICONO_AUDIENCIA: Record<Audiencia, LucideIcon> = {
  alumnos: GraduationCap,
  profesores: Presentation,
  familias: UsersRound,
};

const ICONO_CATEGORIA: Record<Categoria, LucideIcon> = {
  pastoral: Church,
  innovacion: Lightbulb,
  general: School,
  otra: Tag,
};

export function IconoAudiencia({ audiencia, className }: { audiencia: string; className?: string }) {
  const Icono = ICONO_AUDIENCIA[audiencia as Audiencia] ?? UsersRound;
  return <Icono aria-hidden className={cn('size-4 shrink-0', className)} />;
}

export function IconoCategoria({ categoria, className }: { categoria: string; className?: string }) {
  const Icono = ICONO_CATEGORIA[categoria as Categoria] ?? Tag;
  return <Icono aria-hidden className={cn('size-4 shrink-0', className)} />;
}

// ─── Tinta sobre el color de una actividad ───────────────────────────────────

function luminancia(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/**
 * El color del texto que va encima de un color de actividad: blanco o casi negro, el que
 * contraste más. Los verdes, ámbar y naranjas de la paleta no llegan a 4,5:1 con blanco
 * en un número pequeño. Si el color no es un hex (una variable CSS), blanco.
 */
export function tintaSobre(color: string | null | undefined): string {
  const l = color ? luminancia(color) : null;
  if (l === null) return '#ffffff';
  const conBlanco = 1.05 / (l + 0.05);
  const conNegro = (l + 0.05) / 0.05; // zinc-950 ≈ negro a estos efectos
  return conNegro > conBlanco ? '#09090b' : '#ffffff';
}

// ─── Guía de la actividad ────────────────────────────────────────────────────

/**
 * Guía vertical del color de la actividad: una línea fina que recorre todas SUS preguntas
 * del editor, para ver de un vistazo dónde empieza y acaba cada bloque sin otra caja.
 * No es la raya de una tarjeta: va por fuera de ellas.
 */
export function GuiaActividad({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-4 sm:pl-5">
      <span aria-hidden style={{ background: color }} className="absolute top-1 bottom-1 left-0 w-[3px] rounded-full opacity-70" />
      {children}
    </div>
  );
}

// ─── Zona plegable ───────────────────────────────────────────────────────────

/** Tarjeta con cabecera que pliega su contenido (los ajustes del editor). */
export function Plegable({
  titulo,
  icono,
  abierto,
  onToggle,
  children,
}: {
  titulo: string;
  icono?: React.ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={claseTarjeta}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-800 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-200 [&_svg]:size-4"
      >
        {icono}
        {titulo}
        <ChevronDown
          aria-hidden
          className={cn('ml-auto text-zinc-500 transition-transform duration-200 dark:text-zinc-400', abierto && 'rotate-180')}
        />
      </button>
      {abierto && <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">{children}</div>}
    </div>
  );
}
