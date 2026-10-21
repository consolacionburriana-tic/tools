'use client';

// Piezas compartidas de Oratorios, Godly Play y Talleres: llamadas a la API y el estado de
// sesiones y avisos con las pastillas comunes. Ficha: docs/26-oratorios.md
import { CircleDashed, Star, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import type {
  AccionLote,
  AccionSesion,
  AvisoCandidato,
  Chip,
  Disponibilidad,
  EntradaSesionCatalogo,
  EntradaTipo,
  Nivel,
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

// ─── Estados ─────────────────────────────────────────────────────────────────

// El tono de cada chip de `lib/oratorios` en las pastillas de estado comunes. Verde, hecho o
// confirmada; ámbar, falta algo; rojo, anulada; gris, borrador. El azul no dice «confirmada»:
// es el color de lo que se pulsa (docs/diseno.md).
const TONO_CHIP: Record<Chip['tono'], TonoEstado> = {
  zinc: 'neutro',
  blue: 'ok',
  emerald: 'ok',
  amber: 'aviso',
  violet: 'aviso',
  sky: 'info',
  rose: 'error',
};

/** El estado de una sesión (o de su aviso), siempre con la palabra a la vista. */
export function EstadoChip({ chip, className }: { chip: Chip; className?: string }) {
  return (
    <Estado tono={TONO_CHIP[chip.tono]} className={className}>
      {chip.texto}
    </Estado>
  );
}

const TONO_AVISO: Record<AvisoCandidato['nivel'], TonoEstado> = {
  rojo: 'error',
  naranja: 'aviso',
  amarillo: 'aviso',
  info: 'ok',
};

/** La palabra corta de cada aviso de un candidato (el texto largo va en el title). */
function palabraAviso(a: AvisoCandidato): string {
  const n = a.simbolo.match(/\d+/)?.[0];
  switch (a.codigo) {
    case 'mismo_hueco':
      return 'Misma hora';
    case 'mismo_profe':
      return 'Mismo profe';
    case 'mismo_dia':
      return 'Mismo día';
    case 'reciente':
      return n ? `A ${n} días` : 'Muy seguido';
    case 'profe_trimestre':
      return n ? `Profe ×${n}` : 'Profe repite';
    case 'salida':
      return 'Salida';
    case 'sin_profe':
      return 'Sin profe';
    case 'cubierta':
      return 'Cubierta';
  }
}

/** Los avisos de un candidato, cada uno con su palabra (el detalle, en el title y para el lector). */
export function AvisosCandidato({ avisos, className }: { avisos: readonly AvisoCandidato[]; className?: string }) {
  if (avisos.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {avisos.map((a) => (
        <Estado key={a.codigo} tono={TONO_AVISO[a.nivel]} title={a.texto}>
          {palabraAviso(a)}
          <span className="sr-only">: {a.texto}</span>
        </Estado>
      ))}
    </span>
  );
}

// ─── Niveles de un hueco ─────────────────────────────────────────────────────

const ICONO_NIVEL: Record<Nivel, typeof Star> = {
  optima: Star,
  alternativa: ThumbsUp,
  ultima: CircleDashed,
};

/** El nivel de un hueco con icono de lucide (no emoji); la palabra la pone quien lo usa. */
export function IconoNivel({ nivel, className }: { nivel: Nivel; className?: string }) {
  const Icono = ICONO_NIVEL[nivel];
  return <Icono className={cn('h-3.5 w-3.5 shrink-0', className)} aria-hidden />;
}
