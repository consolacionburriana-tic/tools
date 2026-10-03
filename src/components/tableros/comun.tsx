'use client';

// Piezas compartidas de los Tableros: llamadas a la API, colores, avatares y chips.
import { AlertTriangle, CalendarClock, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  estadoVence,
  iniciales,
  indiceColorPersona,
  PRIORIDAD_LABELS,
  textoVence,
  type EntradaAccionEquipo as AccionEquipo,
  type EntradaAccionTablero as AccionTablero,
  type EntradaAccionTarjeta as AccionTarjeta,
  type ColorEtiqueta,
  type ColorTablero,
  type EntradaCrearEquipo as CrearEquipo,
  type DatosTablero,
  type Equipo,
  type Miembro,
  type Persona,
  type Preferencias,
  type Prioridad,
  type Seguimiento,
  type Tarjeta,
  type TarjetaMia,
} from '@/lib/tableros';

// ─── API ─────────────────────────────────────────────────────────────────────
async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Algo ha fallado');
  return json as T;
}

const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  inicio: () => pedir<{ equipos: Equipo[]; mias: TarjetaMia[]; hoy: string }>('/api/tableros'),
  mias: () => pedir<{ mias: TarjetaMia[]; hoy: string }>('/api/tableros/mios'),
  personas: () => pedir<{ personas: Persona[] }>('/api/tableros/personas').then((r) => r.personas),
  crearEquipo: (datos: CrearEquipo) =>
    pedir<{ id: string }>('/api/tableros', { method: 'POST', body: JSON.stringify(datos) }),
  equipo: (id: string, a: AccionEquipo) =>
    pedir<{ ok: true; tableroId: string | null; miembros: Miembro[] | null }>(`/api/tableros/equipos/${id}`, patch(a)),
  borrarEquipo: (id: string) => pedir<{ ok: true }>(`/api/tableros/equipos/${id}`, { method: 'DELETE' }),
  tablero: (id: string) => pedir<DatosTablero>(`/api/tableros/tablero/${id}`),
  archivadas: (id: string) =>
    pedir<{ tarjetas: Tarjeta[] }>(`/api/tableros/tablero/${id}?archivadas=1`).then((r) => r.tarjetas),
  accionTablero: (id: string, a: AccionTablero) =>
    pedir<{ ok: true; tarjeta: Tarjeta | null; columnaId: string | null }>(`/api/tableros/tablero/${id}`, patch(a)),
  borrarTablero: (id: string) => pedir<{ ok: true }>(`/api/tableros/tablero/${id}`, { method: 'DELETE' }),
  seguimiento: (id: string) =>
    pedir<{ seguimiento: Seguimiento[] }>(`/api/tableros/tarjeta/${id}`).then((r) => r.seguimiento),
  tarjeta: (id: string, a: AccionTarjeta) =>
    pedir<{ ok: true; tarjeta: Tarjeta | null; seguimiento: Seguimiento[] | null }>(`/api/tableros/tarjeta/${id}`, patch(a)),
  borrarTarjeta: (id: string) => pedir<{ ok: true }>(`/api/tableros/tarjeta/${id}`, { method: 'DELETE' }),
  preferencias: () => pedir<{ preferencias: Preferencias }>('/api/tableros/preferencias').then((r) => r.preferencias),
  guardarPreferencias: (p: Preferencias) =>
    pedir<{ preferencias: Preferencias }>('/api/tableros/preferencias', { method: 'PUT', body: JSON.stringify(p) }).then(
      (r) => r.preferencias,
    ),
};

export const nuevoId = () => crypto.randomUUID();

// ─── Colores ─────────────────────────────────────────────────────────────────
// Clases escritas enteras (Tailwind solo genera las que ve en el código).

/** Degradado intenso: las baldosas de tablero y la cabecera de cada equipo. */
export const FONDO_FUERTE: Record<ColorTablero, string> = {
  azul: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  violeta: 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
  verde: 'bg-gradient-to-br from-emerald-500 to-green-600',
  naranja: 'bg-gradient-to-br from-orange-400 to-red-500',
  rosa: 'bg-gradient-to-br from-pink-400 to-rose-500',
  teal: 'bg-gradient-to-br from-teal-400 to-cyan-600',
  ambar: 'bg-gradient-to-br from-amber-400 to-orange-500',
  gris: 'bg-gradient-to-br from-zinc-500 to-slate-700',
};

/** Degradado suave: el fondo del tablero abierto, para que las tarjetas blancas destaquen. */
export const FONDO_SUAVE: Record<ColorTablero, string> = {
  azul: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-sky-100 dark:from-blue-950/60 dark:via-zinc-950 dark:to-indigo-950/60',
  violeta: 'bg-gradient-to-br from-violet-100 via-fuchsia-50 to-purple-100 dark:from-violet-950/60 dark:via-zinc-950 dark:to-fuchsia-950/60',
  verde: 'bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 dark:from-emerald-950/60 dark:via-zinc-950 dark:to-green-950/60',
  naranja: 'bg-gradient-to-br from-orange-100 via-amber-50 to-red-100 dark:from-orange-950/60 dark:via-zinc-950 dark:to-red-950/60',
  rosa: 'bg-gradient-to-br from-pink-100 via-rose-50 to-fuchsia-100 dark:from-pink-950/60 dark:via-zinc-950 dark:to-rose-950/60',
  teal: 'bg-gradient-to-br from-teal-100 via-cyan-50 to-sky-100 dark:from-teal-950/60 dark:via-zinc-950 dark:to-cyan-950/60',
  ambar: 'bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-950/60 dark:via-zinc-950 dark:to-orange-950/60',
  gris: 'bg-gradient-to-br from-zinc-200 via-zinc-100 to-slate-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-slate-900',
};

/** La muestra de color en los selectores. */
export const MUESTRA_TABLERO: Record<ColorTablero, string> = {
  azul: 'bg-blue-500',
  violeta: 'bg-violet-500',
  verde: 'bg-emerald-500',
  naranja: 'bg-orange-500',
  rosa: 'bg-pink-500',
  teal: 'bg-teal-500',
  ambar: 'bg-amber-400',
  gris: 'bg-zinc-500',
};

export const ETIQUETA_CLASES: Record<ColorEtiqueta, { fondo: string; barra: string }> = {
  rojo: { fondo: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200', barra: 'bg-red-500' },
  naranja: { fondo: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200', barra: 'bg-orange-500' },
  ambar: { fondo: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', barra: 'bg-amber-400' },
  verde: { fondo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200', barra: 'bg-emerald-500' },
  teal: { fondo: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200', barra: 'bg-teal-500' },
  azul: { fondo: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200', barra: 'bg-blue-500' },
  violeta: { fondo: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200', barra: 'bg-violet-500' },
  rosa: { fondo: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200', barra: 'bg-pink-500' },
  gris: { fondo: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200', barra: 'bg-zinc-400' },
};

export const PRIORIDAD_CLASES: Record<Prioridad, string> = {
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200',
  urgente: 'bg-red-600 text-white dark:bg-red-500',
};

/** El borde izquierdo de la tarjeta según su prioridad: se lee de lejos. */
export const PRIORIDAD_BORDE: Record<Prioridad, string> = {
  baja: 'border-l-slate-300 dark:border-l-slate-600',
  media: 'border-l-blue-400',
  alta: 'border-l-orange-500',
  urgente: 'border-l-red-600',
};

const AVATAR = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-cyan-600',
];

export const EMOJIS_TABLERO = [
  '📋', '✅', '🧑‍💻', '🛠️', '💻', '📱', '🖨️', '📽️', '🌐', '🔧',
  '📚', '🎒', '🏫', '🎭', '⚽', '🎨', '🎵', '🙏', '❤️', '🌱',
  '📣', '📆', '💡', '🚀', '⭐', '🧹', '📦', '🧾', '👥', '🗂️',
];

// ─── Avatares ────────────────────────────────────────────────────────────────
export function Avatar({
  email,
  nombre,
  className,
  title,
}: {
  email: string;
  nombre?: string | null;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? nombre ?? email}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white select-none dark:ring-zinc-900',
        AVATAR[indiceColorPersona(email, AVATAR.length)],
        className,
      )}
    >
      {iniciales(nombre, email)}
    </span>
  );
}

export function Avatares({
  emails,
  personas,
  max = 3,
  className,
  tamano = 'h-6 w-6 text-[10px]',
}: {
  emails: string[];
  personas: readonly Persona[];
  max?: number;
  className?: string;
  tamano?: string;
}) {
  if (emails.length === 0) return null;
  const vistos = emails.slice(0, max);
  const resto = emails.length - vistos.length;
  return (
    <span className={cn('flex -space-x-1.5', className)}>
      {vistos.map((e) => (
        <Avatar key={e} email={e} nombre={personas.find((p) => p.email === e)?.nombre} className={tamano} />
      ))}
      {resto > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-900',
            tamano,
          )}
        >
          +{resto}
        </span>
      )}
    </span>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────────
export function ChipPrioridad({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        PRIORIDAD_CLASES[prioridad],
        className,
      )}
    >
      {prioridad === 'urgente' ? <AlertTriangle className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
      {PRIORIDAD_LABELS[prioridad]}
    </span>
  );
}

const VENCE_CLASES = {
  vencida: 'bg-red-600 text-white dark:bg-red-500',
  hoy: 'bg-orange-500 text-white',
  manana: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  pronto: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  futura: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  hecha: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 line-through decoration-emerald-600/40',
  sin: '',
} as const;

export function ChipVence({
  vence,
  hoy,
  hecha = false,
  className,
}: {
  vence: string;
  hoy: string;
  hecha?: boolean;
  className?: string;
}) {
  const { estado } = estadoVence(vence, hoy, hecha);
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', VENCE_CLASES[estado], className)}
      title={`Fecha límite: ${vence}`}
    >
      <CalendarClock className="h-3 w-3" />
      {textoVence(vence, hoy)}
    </span>
  );
}

export const ESTILO_CAMPO =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export const BOTON_PRIMARIO =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50';

export const BOTON_SECUNDARIO =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

/** Selector de color de tablero/equipo: una fila de círculos. */
export function SelectorColor({ valor, onChange }: { valor: ColorTablero; onChange: (c: ColorTablero) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(MUESTRA_TABLERO) as ColorTablero[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'h-8 w-8 rounded-full transition-transform',
            MUESTRA_TABLERO[c],
            valor === c ? 'scale-110 ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : 'hover:scale-105',
          )}
        />
      ))}
    </div>
  );
}
