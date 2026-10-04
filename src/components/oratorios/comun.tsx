'use client';

// Piezas compartidas de Oratorios y Godly Play: llamadas a la API, chips y avisos en
// símbolos. Ficha: docs/26-oratorios.md
import { cn } from '@/lib/utils';
import type {
  AccionLote,
  AccionSesion,
  AvisoCandidato,
  Chip,
  Disponibilidad,
  EntradaSesionCatalogo,
  EntradaTipo,
  NuevaSesion,
  SesionCatalogo,
  SesionOra,
  TipoMomento,
  Trimestre,
} from '@/lib/oratorios';

// ─── API ─────────────────────────────────────────────────────────────────────

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  const texto = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    // Una respuesta que no es JSON es casi siempre un timeout de la plataforma.
    throw new Error(res.status >= 500 ? 'El servidor ha tardado demasiado; vuelve a probar' : 'Respuesta inesperada del servidor');
  }
  if (!res.ok) throw new Error((json.error as string) ?? 'Algo ha fallado');
  return json as T;
}

export interface ResultadoLote {
  sesiones: SesionOra[];
  borradas: string[];
  mensaje: string;
}

export const api = {
  crear: (sesiones: NuevaSesion[]) =>
    pedir<{ sesiones: SesionOra[] }>('/api/oratorios/sesiones', { method: 'POST', body: JSON.stringify({ sesiones }) }).then((r) => r.sesiones),
  accion: (id: string, a: AccionSesion) =>
    pedir<{ sesion: SesionOra }>(`/api/oratorios/sesiones/${id}`, { method: 'PATCH', body: JSON.stringify(a) }).then((r) => r.sesion),
  borrar: (id: string) => pedir<{ ok: true }>(`/api/oratorios/sesiones/${id}`, { method: 'DELETE' }),
  lote: (accion: AccionLote, ids: string[], dias?: number) =>
    pedir<ResultadoLote>('/api/oratorios/sesiones/lote', { method: 'POST', body: JSON.stringify({ accion, ids, dias }) }),
  disponibilidad: (responsableEmail: string, huecos: Disponibilidad[]) =>
    pedir<{ huecos: Disponibilidad[] }>('/api/oratorios/disponibilidad', { method: 'PUT', body: JSON.stringify({ responsableEmail, huecos }) }).then(
      (r) => r.huecos,
    ),
  ajustes: (academicYear: string, cambios: { trimestres?: Trimestre[]; accesoComun?: boolean }) =>
    pedir<{ ajustes: { trimestres: Trimestre[]; accesoComun: boolean; guardados: boolean; academicYear: string } }>('/api/oratorios/ajustes', {
      method: 'PATCH',
      body: JSON.stringify({ academicYear, ...cambios }),
    }).then((r) => r.ajustes),
  tipo: (id: string | null, tipo: EntradaTipo) =>
    pedir<{ tipo: TipoMomento }>('/api/oratorios/tipos', { method: 'POST', body: JSON.stringify({ id, tipo }) }).then((r) => r.tipo),
  /** Crear o editar una sesión del abanico (lo que se hace en el momento). */
  sesionAbanico: (id: string | null, sesion: EntradaSesionCatalogo) =>
    pedir<{ sesion: SesionCatalogo }>('/api/oratorios/catalogo', { method: 'POST', body: JSON.stringify({ id, sesion }) }).then((r) => r.sesion),
  borrarSesionAbanico: (id: string) => pedir<{ ok: true }>(`/api/oratorios/catalogo/${id}`, { method: 'DELETE' }),
};

/** 'lunes, 5 de octubre' → 'Lunes, 5 de octubre' (el `capitalize` de CSS pone «De Octubre»). */
export const capital = (t: string) => t.charAt(0).toLocaleUpperCase('es') + t.slice(1);

// ─── Chips ───────────────────────────────────────────────────────────────────

const TONOS: Record<Chip['tono'], string> = {
  zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

export function ChipVista({ chip, corto = false, className }: { chip: Chip; corto?: boolean; className?: string }) {
  return (
    <span
      title={chip.texto}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONOS[chip.tono], className)}
    >
      <span aria-hidden>{chip.emoji}</span>
      {!corto && chip.texto}
    </span>
  );
}

const TONO_AVISO: Record<AvisoCandidato['nivel'], string> = {
  rojo: 'bg-rose-100 text-rose-700 ring-1 ring-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/40',
  naranja: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  amarillo: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  info: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};

/** Los avisos de un candidato, en símbolos (el texto largo va en el title). */
export function Avisos({ avisos, className }: { avisos: readonly AvisoCandidato[]; className?: string }) {
  if (avisos.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {avisos.map((a) => (
        <span key={a.codigo} title={a.texto} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', TONO_AVISO[a.nivel])}>
          {a.simbolo}
        </span>
      ))}
    </span>
  );
}

/** Botón-chip de los que se usan en toda la pantalla (pestañas, filtros, rangos). */
export function Pastilla({
  activa,
  onClick,
  children,
  title,
  className,
  disabled,
}: {
  activa?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors disabled:opacity-40',
        activa
          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Botón de acción con icono y poco texto. */
export function Accion({
  onClick,
  children,
  title,
  tono = 'neutro',
  disabled,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  tono?: 'neutro' | 'azul' | 'verde' | 'rojo';
  disabled?: boolean;
  className?: string;
}) {
  const tonos = {
    neutro: 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
    azul: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500',
    verde: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600',
    rojo: 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-500/10',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-40', tonos[tono], className)}
    >
      {children}
    </button>
  );
}

/** Selector nativo con pinta de chip (en iPad abre la rueda del sistema). */
export function SelectChip({
  value,
  onChange,
  children,
  title,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <select
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'min-h-9 max-w-full rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
        className,
      )}
    >
      {children}
    </select>
  );
}
