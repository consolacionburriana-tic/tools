// Identidad visual del módulo: un color y un icono por fichero, usados igual en la
// portada, en las pestañas y en el explorador. Las clases van escritas enteras porque
// Tailwind no ve las que se construyen concatenando.
import { GraduationCap, Layers, ListChecks, MapPin, Presentation, Users } from 'lucide-react';
import type { ArchivoAsm } from '@/lib/autoasm';

export interface EstiloArchivo {
  Icono: typeof MapPin;
  /** Color del icono. */
  icono: string;
  /** Fondo tenue de la pastilla del icono. */
  fondo: string;
  /** Borde al pasar por encima / activo. */
  borde: string;
  /** Punto o barra de color sólido. */
  solido: string;
  /** Pestaña activa. */
  activo: string;
}

export const ESTILO: Record<ArchivoAsm, EstiloArchivo> = {
  locations: {
    Icono: MapPin,
    icono: 'text-sky-600 dark:text-sky-400',
    fondo: 'bg-sky-50 dark:bg-sky-500/10',
    borde: 'hover:border-sky-300 dark:hover:border-sky-700',
    solido: 'bg-sky-500',
    activo: 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  students: {
    Icono: GraduationCap,
    icono: 'text-blue-600 dark:text-blue-400',
    fondo: 'bg-blue-50 dark:bg-blue-500/10',
    borde: 'hover:border-blue-300 dark:hover:border-blue-700',
    solido: 'bg-blue-500',
    activo: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  },
  staff: {
    Icono: Users,
    icono: 'text-violet-600 dark:text-violet-400',
    fondo: 'bg-violet-50 dark:bg-violet-500/10',
    borde: 'hover:border-violet-300 dark:hover:border-violet-700',
    solido: 'bg-violet-500',
    activo: 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  courses: {
    Icono: Layers,
    icono: 'text-amber-600 dark:text-amber-400',
    fondo: 'bg-amber-50 dark:bg-amber-500/10',
    borde: 'hover:border-amber-300 dark:hover:border-amber-700',
    solido: 'bg-amber-500',
    activo: 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  classes: {
    Icono: Presentation,
    icono: 'text-emerald-600 dark:text-emerald-400',
    fondo: 'bg-emerald-50 dark:bg-emerald-500/10',
    borde: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    solido: 'bg-emerald-500',
    activo: 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  rosters: {
    Icono: ListChecks,
    icono: 'text-rose-600 dark:text-rose-400',
    fondo: 'bg-rose-50 dark:bg-rose-500/10',
    borde: 'hover:border-rose-300 dark:hover:border-rose-700',
    solido: 'bg-rose-500',
    activo: 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
};

/** Número grande con separador de miles a la española. */
export function num(n: number): string {
  return n.toLocaleString('es-ES');
}
