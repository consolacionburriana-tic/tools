'use client';

// Piezas pequeñas que comparten las pantallas de Sustituciones (docs/32): la disponibilidad con su
// icono (nada de emojis: diseno.md), el estado de un aviso y la llamada a la API.
import { Ban, Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { DISPONIBILIDAD_INFO, type Disponibilidad } from '@/lib/sustituciones';

export const ICONO_DISPONIBILIDAD: Record<Disponibilidad, LucideIcon> = { si: Smile, si_hace_falta: Meh, urgencia: Frown, no: Ban };

/** Colores de la rejilla: verde (Sí), neutro (Si hace falta), ámbar (Solo urgencia), gris (No). */
export const COLOR_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  si: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  si_hace_falta: 'bg-white text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700',
  urgencia: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  no: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700',
};

export function IconoDisponibilidad({ d, className }: { d: Disponibilidad; className?: string }) {
  const Icono = ICONO_DISPONIBILIDAD[d];
  return <Icono aria-hidden className={cn('size-4 shrink-0', className)} />;
}

export function EtiquetaDisponibilidad({ d }: { d: Disponibilidad }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <IconoDisponibilidad d={d} />
      {DISPONIBILIDAD_INFO[d].nombre}
    </span>
  );
}

/** El estado de una hora: cubierta (verde), sin cubrir (ámbar), correo con error (rojo), solo cuenta (gris). */
export function EstadoHora({ hayQueCubrir, sustituto, avisoEstado }: { hayQueCubrir: boolean; sustituto: string | null; avisoEstado: string }) {
  let tono: TonoEstado = 'neutro';
  let texto = 'Solo cuenta';
  if (hayQueCubrir && avisoEstado === 'error') {
    tono = 'error';
    texto = 'Correo con error';
  } else if (hayQueCubrir && sustituto) {
    tono = 'ok';
    texto = 'Cubierta';
  } else if (hayQueCubrir) {
    tono = 'aviso';
    texto = 'Sin cubrir';
  }
  return <Estado tono={tono}>{texto}</Estado>;
}

export const TEXTO_AVISO: Record<string, string> = { no: 'Sin avisar', enviado: 'Avisado', error: 'Error al avisar' };

/** fetch con JSON y el error del servidor como mensaje. */
export async function pedir<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? 'POST' : 'GET'),
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((datos as { error?: string }).error ?? 'Algo ha fallado. Inténtalo otra vez.');
  return datos as T;
}

export interface Avisos {
  enviados: number;
  fallidos: { nombre: string; error: string }[];
}

/** «Avisadas 3 personas» / «Avisadas 2; falló el correo a Lucía». */
export function textoAvisos(a: Avisos | null | undefined): string | null {
  if (!a) return null;
  const ok = a.enviados === 1 ? 'Avisada 1 persona' : `Avisadas ${a.enviados} personas`;
  if (a.fallidos.length === 0) return a.enviados ? ok : null;
  return `${a.enviados ? `${ok}; ` : ''}falló el correo a ${a.fallidos.map((f) => f.nombre).join(', ')}`;
}

export function horaRango(inicio: string, fin: string): string {
  const h = (x: string) => x.replace(/^0(\d)/, '$1');
  return `${h(inicio)}-${h(fin)}`;
}
