'use client';

// Piezas compartidas de los Tableros: llamadas a la API, colores y chips.
import { AlertTriangle, CalendarClock, Check, Flag } from 'lucide-react';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { cn } from '@/lib/utils';
import {
  estadoVence,
  PRIORIDAD_LABELS,
  textoVence,
  type EntradaAccionEquipo as AccionEquipo,
  type EntradaAccionTablero as AccionTablero,
  type EntradaAccionTarjeta as AccionTarjeta,
  type ColorEtiqueta,
  type ColorTablero,
  type EntradaCrearEquipo as CrearEquipo,
  type DatosTablero,
  type EstadoVence,
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

/**
 * Fuera del tablero, el color va en poco sitio y sin degradados: un cuadrado suave detrás del
 * emoji (`TINTE`) y una raya fina arriba de cada baldosa (`ACENTO`). Lo limpio se lee mejor.
 */
export const TINTE: Record<ColorTablero, string> = {
  azul: 'bg-blue-50 ring-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/20',
  violeta: 'bg-violet-50 ring-violet-100 dark:bg-violet-500/10 dark:ring-violet-500/20',
  verde: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20',
  naranja: 'bg-orange-50 ring-orange-100 dark:bg-orange-500/10 dark:ring-orange-500/20',
  rosa: 'bg-pink-50 ring-pink-100 dark:bg-pink-500/10 dark:ring-pink-500/20',
  teal: 'bg-teal-50 ring-teal-100 dark:bg-teal-500/10 dark:ring-teal-500/20',
  ambar: 'bg-amber-50 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20',
  gris: 'bg-zinc-100 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700',
};

export const ACENTO: Record<ColorTablero, string> = {
  azul: 'bg-blue-500',
  violeta: 'bg-violet-500',
  verde: 'bg-emerald-500',
  naranja: 'bg-orange-500',
  rosa: 'bg-pink-500',
  teal: 'bg-teal-500',
  ambar: 'bg-amber-400',
  gris: 'bg-zinc-400',
};

/** Degradado muy suave: el fondo del tablero abierto, para que las tarjetas blancas destaquen. */
export const FONDO_SUAVE: Record<ColorTablero, string> = {
  azul: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-sky-100 dark:from-blue-950/60 dark:via-zinc-950 dark:to-indigo-950/60',
  violeta: 'bg-gradient-to-br from-violet-100 via-fuchsia-50 to-purple-100 dark:from-violet-950/60 dark:via-zinc-950 dark:to-fuchsia-950/60',
  verde: 'bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 dark:from-emerald-950/60 dark:via-zinc-950 dark:to-green-950/60',
  naranja: 'bg-gradient-to-br from-orange-100 via-amber-50 to-red-100 dark:from-orange-950/60 dark:via-zinc-950 dark:to-red-950/60',
  rosa: 'bg-gradient-to-br from-pink-100 via-rose-50 to-fuchsia-100 dark:from-pink-950/60 dark:via-zinc-950 dark:to-rose-950/60',
  teal: 'bg-gradient-to-br from-teal-100 via-cyan-50 to-sky-100 dark:from-teal-950/60 dark:via-zinc-950 dark:to-cyan-950/60',
  ambar: 'bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-950/60 dark:via-zinc-950 dark:to-orange-950/60',
  gris: 'bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900',
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

/** El tono de la pastilla de prioridad: lo urgente en rojo, lo alto en ámbar, lo demás tranquilo. */
export const TONO_PRIORIDAD: Record<Prioridad, TonoEstado> = {
  baja: 'neutro',
  media: 'info',
  alta: 'aviso',
  urgente: 'error',
};

export const EMOJIS_TABLERO = [
  '📋', '✅', '🧑‍💻', '🛠️', '💻', '📱', '🖨️', '📽️', '🌐', '🔧',
  '📚', '🎒', '🏫', '🎭', '⚽', '🎨', '🎵', '🙏', '❤️', '🌱',
  '📣', '📆', '💡', '🚀', '⭐', '🧹', '📦', '🧾', '👥', '🗂️',
];

// ─── Personas ────────────────────────────────────────────────────────────────
/** De una lista de correos a personas con nombre, para `Avatares`. */
export function personasDe(emails: readonly string[], personas: readonly Persona[]): Persona[] {
  return emails.map((email) => ({ email, nombre: personas.find((p) => p.email === email)?.nombre ?? email }));
}

// ─── Chips ───────────────────────────────────────────────────────────────────
export function ChipPrioridad({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <Estado
      tono={TONO_PRIORIDAD[prioridad]}
      icono={prioridad === 'urgente' ? <AlertTriangle aria-hidden /> : <Flag aria-hidden />}
      className={className}
    >
      {PRIORIDAD_LABELS[prioridad]}
    </Estado>
  );
}

const TONO_VENCE: Record<EstadoVence, TonoEstado> = {
  vencida: 'error',
  hoy: 'aviso',
  manana: 'aviso',
  pronto: 'aviso',
  futura: 'neutro',
  hecha: 'ok',
  sin: 'neutro',
};

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
    <Estado tono={TONO_VENCE[estado]} icono={<CalendarClock aria-hidden />} className={className}>
      <span className="sr-only">Fecha límite: </span>
      {textoVence(vence, hoy)}
    </Estado>
  );
}

const NOMBRE_COLOR: Record<ColorTablero, string> = {
  azul: 'Azul',
  violeta: 'Violeta',
  verde: 'Verde',
  naranja: 'Naranja',
  rosa: 'Rosa',
  teal: 'Turquesa',
  ambar: 'Ámbar',
  gris: 'Gris',
};

/** Selector de color de tablero/equipo: una fila de círculos de 40 px, el elegido con su marca. */
export function SelectorColor({ valor, onChange }: { valor: ColorTablero; onChange: (c: ColorTablero) => void }) {
  return (
    <div role="group" aria-label="Color" className="flex flex-wrap gap-2">
      {(Object.keys(MUESTRA_TABLERO) as ColorTablero[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={NOMBRE_COLOR[c]}
          aria-pressed={valor === c}
          className={cn(
            'flex size-10 items-center justify-center rounded-full text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            MUESTRA_TABLERO[c],
            valor === c && 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900',
          )}
        >
          {valor === c && <Check aria-hidden className="size-4" />}
        </button>
      ))}
    </div>
  );
}
