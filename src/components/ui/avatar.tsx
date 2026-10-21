import { cn } from '@/lib/utils';
import { iniciales, indiceColorPersona } from '@/lib/personas';

// Una persona en pequeño: sus iniciales en un círculo de color. El color sale de su correo,
// así que es el mismo en toda la app. `Avatares` apila varios y resume el resto en «+3».

// Todos dan 4,5:1 o más con el texto blanco.
const COLORES = [
  'bg-blue-600',
  'bg-emerald-700',
  'bg-violet-600',
  'bg-orange-700',
  'bg-pink-700',
  'bg-teal-700',
  'bg-amber-700',
  'bg-indigo-600',
  'bg-rose-700',
  'bg-cyan-700',
];

const TAMANO = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export type TamanoAvatar = keyof typeof TAMANO;

export function Avatar({
  email,
  nombre,
  tamano = 'md',
  neutro = false,
  title,
  className,
}: {
  /** Lo que da el color (y las iniciales si no hay nombre): el correo o cualquier id estable. */
  email: string;
  nombre?: string | null;
  tamano?: TamanoAvatar;
  /** Gris en vez de color: para listas donde el color ya dice otra cosa (estados). */
  neutro?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title ?? nombre ?? email}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white select-none dark:ring-zinc-900',
        neutro
          ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          : cn('text-white', COLORES[indiceColorPersona(email, COLORES.length)]),
        TAMANO[tamano],
        className,
      )}
    >
      {iniciales(nombre, email)}
    </span>
  );
}

export function Avatares({
  personas,
  max = 3,
  tamano = 'sm',
  className,
}: {
  personas: readonly { email: string; nombre?: string | null }[];
  max?: number;
  tamano?: TamanoAvatar;
  className?: string;
}) {
  if (personas.length === 0) return null;
  const vistas = personas.slice(0, max);
  const resto = personas.length - vistas.length;
  return (
    <span className={cn('flex -space-x-1.5', className)}>
      {vistas.map((p) => (
        <Avatar key={p.email} email={p.email} nombre={p.nombre} tamano={tamano} />
      ))}
      {resto > 0 && (
        <span
          title={personas
            .slice(max)
            .map((p) => p.nombre || p.email)
            .join(', ')}
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-900',
            TAMANO[tamano],
          )}
        >
          +{resto}
        </span>
      )}
    </span>
  );
}
