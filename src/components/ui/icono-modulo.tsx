import {
  AlarmClock,
  Apple,
  AtSign,
  BookMarked,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  ChartColumnBig,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Database,
  GraduationCap,
  HandHeart,
  KanbanSquare,
  KeyRound,
  Library,
  ListTodo,
  NotebookPen,
  Palette,
  SlidersHorizontal,
  Tablet,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Grupo } from '@/lib/escritorio';
import type { IconoModulo as NombreIcono } from '@/lib/modulos';

/** El icono de cada módulo, por nombre (las listas viajan del servidor a la pantalla como datos). */
export const ICONOS_MODULO: Record<NombreIcono, LucideIcon> = {
  horario: CalendarCheck,
  tableros: KanbanSquare,
  conducta: ClipboardPlus,
  oratorios: HandHeart,
  alumnado: Users,
  nouvinguts: UserPlus,
  numeros: ChartColumnBig,
  cuaderno: NotebookPen,
  abc: ClipboardList,
  puntualidad: AlarmClock,
  licencias: BookMarked,
  banco: Library,
  salidas: Bus,
  horarios: CalendarDays,
  evaluaciones: ClipboardCheck,
  profes: GraduationCap,
  dispositivos: Tablet,
  cuentas: AtSign,
  calendarios: CalendarX2,
  autoasm: Apple,
  usuarios: KeyRound,
  educamos: Database,
  ajustes: SlidersHorizontal,
  tareas: ListTodo,
  diseno: Palette,
};

/**
 * El color de identidad de cada grupo del escritorio. Va SOLO en el icono del módulo (aquí,
 * en la cabecera y en el escritorio): lo que se pulsa es siempre azul. Ninguno es verde, ámbar
 * ni rojo, que son los colores de estado (hecho, falta algo, error).
 */
export const ACENTO_GRUPO: Record<Grupo, string> = {
  dia: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  alumnado: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  familias: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300',
  centro: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  tic: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  config: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

const TAMANO = {
  sm: { caja: 'size-8 rounded-lg', icono: 'size-4.5' },
  md: { caja: 'size-10 rounded-xl', icono: 'size-5' },
  lg: { caja: 'size-11 rounded-xl', icono: 'size-5.5' },
} as const;

/** El icono de un módulo en su cuadradito de color. */
export function IconoModulo({
  icono,
  grupo,
  tamano = 'md',
  className,
}: {
  icono: NombreIcono;
  grupo: Grupo;
  tamano?: keyof typeof TAMANO;
  className?: string;
}) {
  const Icono = ICONOS_MODULO[icono];
  const t = TAMANO[tamano];
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center', t.caja, ACENTO_GRUPO[grupo], className)}>
      <Icono className={t.icono} />
    </span>
  );
}
