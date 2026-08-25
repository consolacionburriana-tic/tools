'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, CalendarDays, Check, ChevronDown, ChevronUp, Copy, Loader2, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { AUDIENCIAS, CATEGORIAS, type Categoria } from '@/lib/evaluaciones';

export interface ActividadFila {
  id: string;
  nombre: string;
  fecha: string | null;
  lugar: string | null;
  categoria: string;
  objetivo: string | null;
  resumen: string | null;
  notas: string | null;
  academicYear: string;
  formularios: { id: string; titulo: string; audiencia: string; estado: string; respuestas: number }[];
}

interface Props {
  academicYear: string;
  academicYearAnterior: string;
  actividades: ActividadFila[];
  actividadesAnterior: { id: string; nombre: string; categoria: string }[];
}

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

const COLOR_CATEGORIA: Record<string, string> = {
  pastoral: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  innovacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  general: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  otra: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
};

/**
 * Catálogo de actividades del curso. Aquí se afinan los textos que luego rellenan
 * solos los formularios: el `objetivo` (que ve el profesorado encima de las preguntas)
 * y el `resumen` (la versión para alumnado, que explica sin soltar el objetivo).
 */
export function ActividadesPanel({ academicYear, academicYearAnterior, actividades, actividadesAnterior }: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [nueva, setNueva] = useState('');

  async function patch(id: string, cambios: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/evaluaciones/admin/actividades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo guardar');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function crear() {
    if (nueva.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await fetch('/api/evaluaciones/admin/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'crear', nombre: nueva.trim(), academicYear, categoria: (filtro as Categoria) ?? 'pastoral' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo crear');
      haptic.success();
      setNueva('');
      toast.success('Actividad creada');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function copiar(id: string, nombre: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/evaluaciones/admin/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'copiar', id, academicYear }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo copiar');
      haptic.success();
      toast.success(`"${nombre}" traída a ${academicYear}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  const visibles = filtro ? actividades.filter((a) => a.categoria === filtro) : actividades;
  const yaTraidas = new Set(actividades.map((a) => a.nombre.toLowerCase()));

  return (
    <div className="anim-stagger space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFiltro(null)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            filtro === null ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          Todas ({actividades.length})
        </button>
        {CATEGORIAS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFiltro(c.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filtro === c.value ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {c.emoji} {c.label} ({actividades.filter((a) => a.categoria === c.value).length})
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void crear()}
          placeholder={`Nueva actividad de ${academicYear}…`}
          className={inputCls}
        />
        <button
          type="button"
          disabled={busy || nueva.trim().length < 2}
          onClick={() => void crear()}
          className="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          No hay actividades{filtro ? ' de este tipo' : ''} en {academicYear}.
        </p>
      ) : (
        visibles.map((a) => (
          <div key={a.id} className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setAbierta((v) => (v === a.id ? null : a.id))}
              className="flex w-full items-start gap-3 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {a.nombre}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_CATEGORIA[a.categoria] ?? ''}`}>
                    {CATEGORIAS.find((c) => c.value === a.categoria)?.label ?? a.categoria}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                  {a.fecha && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(`${a.fecha}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {a.lugar && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {a.lugar}
                    </span>
                  )}
                  {a.formularios.length === 0 ? (
                    <span>sin evaluación todavía</span>
                  ) : (
                    a.formularios.map((f) => (
                      <span key={f.id}>
                        {AUDIENCIAS.find((x) => x.value === f.audiencia)?.emoji} {f.respuestas} resp.
                      </span>
                    ))
                  )}
                </p>
              </div>
              {abierta === a.id ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
            </button>

            {abierta === a.id && (
              <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Fecha</label>
                    <input
                      type="date"
                      defaultValue={a.fecha ?? ''}
                      onBlur={(e) => e.target.value !== (a.fecha ?? '') && void patch(a.id, { fecha: e.target.value || null })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Lugar</label>
                    <input
                      defaultValue={a.lugar ?? ''}
                      onBlur={(e) => e.target.value !== (a.lugar ?? '') && void patch(a.id, { lugar: e.target.value || null })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Objetivo · lo que ve el profesorado
                  </label>
                  <textarea
                    defaultValue={a.objetivo ?? ''}
                    rows={2}
                    placeholder="Dinámicas en las que trabajamos la carta del Papa sobre la educación."
                    onBlur={(e) => e.target.value !== (a.objetivo ?? '') && void patch(a.id, { objetivo: e.target.value || null })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Resumen · la versión para el alumnado
                  </label>
                  <textarea
                    defaultValue={a.resumen ?? ''}
                    rows={2}
                    placeholder="Celebración de la ceniza en la capilla."
                    onBlur={(e) => e.target.value !== (a.resumen ?? '') && void patch(a.id, { resumen: e.target.value || null })}
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => void patch(a.id, { categoria: c.value })}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        a.categoria === c.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>

                {a.formularios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {a.formularios.map((f) => (
                      <Link
                        key={f.id}
                        href={`/gestion/evaluaciones/${f.id}/resultados`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
                      >
                        {AUDIENCIAS.find((x) => x.value === f.audiencia)?.emoji} {f.titulo} · {f.respuestas} resp.
                      </Link>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`¿Archivar "${a.nombre}"? Deja de salir en los selectores; sus datos se conservan.`)) return;
                    void patch(a.id, { archivada: true });
                  }}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-600"
                >
                  <Archive className="h-3.5 w-3.5" /> Archivar
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {actividadesAnterior.filter((a) => !yaTraidas.has(a.nombre.toLowerCase())).length > 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">De {academicYearAnterior}</p>
          <p className="mb-2.5 text-xs text-zinc-500">
            Tócala y se copia a {academicYear} conservando el hilo entre cursos, para poder comparar las dos ediciones.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {actividadesAnterior
              .filter((a) => !yaTraidas.has(a.nombre.toLowerCase()))
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void copiar(a.id, a.nombre)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-600"
                >
                  <Copy className="h-3.5 w-3.5" /> {a.nombre}
                </button>
              ))}
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Check className="h-3.5 w-3.5" /> Los cambios se guardan al salir de cada campo.
      </p>
    </div>
  );
}
