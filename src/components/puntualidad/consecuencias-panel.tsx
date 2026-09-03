'use client';

// Consecuencias. Arriba las que esperan fecha (lo que hay que resolver hoy), abajo las ya
// puestas con su seguimiento. Todo se toca en la fila: fecha en un toque, y los dos
// interruptores de "ya la ha cumplido" y "avisado en Educamos".
//
// El botón de crear a mano existe porque una consecuencia no siempre viene de un retraso
// (el día que esto sea su propio módulo, esta pantalla ya funciona así).
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarPlus, ChevronDown, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Chip, ClaseChip, Interruptor } from './ui';
import { haptic } from '@/lib/haptics';
import type { AlumnoBusqueda, ConsecuenciaFila } from '@/lib/puntualidad-server';

const fmt = (iso: string, patron = 'EEE d MMM') => {
  try {
    return format(parseISO(iso), patron, { locale: es });
  } catch {
    return iso;
  }
};

export function ConsecuenciasPanel({
  consecuencias,
  puedeCrear,
}: {
  consecuencias: ConsecuenciaFila[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const refrescar = () => startTransition(() => router.refresh());

  const patch = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const res = await fetch(`/api/puntualidad/admin/consecuencias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      await haptic.success();
      refrescar();
    } catch (error) {
      await haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (c: ConsecuenciaFila) => {
    if (!confirm(`¿Borrar la consecuencia de ${c.alumno}?`)) return;
    setOcupado(c.id);
    try {
      const res = await fetch(`/api/puntualidad/admin/consecuencias/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo borrar');
      toast.success('Consecuencia borrada');
      refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo borrar');
    } finally {
      setOcupado(null);
    }
  };

  const pendientes = consecuencias.filter((c) => !c.fecha);
  const puestas = consecuencias.filter((c) => c.fecha);

  const Fila = ({ c }: { c: ConsecuenciaFila }) => {
    const hoy = new Date();
    const rapidas = [
      { label: 'Hoy', valor: format(hoy, 'yyyy-MM-dd') },
      { label: 'Mañana', valor: format(addDays(hoy, 1), 'yyyy-MM-dd') },
      { label: 'Pasado', valor: format(addDays(hoy, 2), 'yyyy-MM-dd') },
    ];
    return (
      <li>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/gestion/puntualidad/alumno/${c.eduStudentId}`}
                className="truncate text-sm font-medium text-zinc-900 transition-colors hover:text-orange-600 dark:text-zinc-100"
              >
                {c.alumno}
              </Link>
              <ClaseChip clase={c.clase} />
              {c.origen === 'manual' && (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800">
                  a mano
                </span>
              )}
            </div>
            <p className="truncate text-xs text-zinc-400">
              {c.fecha ? `Sin patio el ${fmt(c.fecha)}` : 'Sin fecha todavía'}
              {c.motivo ? ` · ${c.motivo}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {c.cumplida && (
              <span className="hidden rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:block dark:bg-emerald-900/30 dark:text-emerald-300">
                cumplida
              </span>
            )}
            {c.avisadaEducamos && (
              <span className="hidden rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 sm:block dark:bg-sky-900/30 dark:text-sky-300">
                Educamos
              </span>
            )}
            {ocupado === c.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <button
                type="button"
                onClick={() => setAbierta(abierta === c.id ? null : c.id)}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Abrir"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${abierta === c.id ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {abierta === c.id && (
          <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
            {c.retrasos.length > 0 && (
              <ul className="space-y-1 text-xs text-zinc-500">
                {c.retrasos.map((r, i) => (
                  <li key={`${r.fecha}-${i}`} className="flex gap-3">
                    <span className="w-24 shrink-0 capitalize">{fmt(r.fecha)}</span>
                    <span className="tabular-nums">{r.hora}</span>
                    <span className="truncate">{r.asignatura ?? 'sin asignatura'}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {rapidas.map((r) => (
                <Chip key={r.valor} tamano="pequeno" activo={c.fecha === r.valor} onClick={() => patch(c.id, { fecha: r.valor })}>
                  {r.label}
                </Chip>
              ))}
              <label className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                <CalendarPlus className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="date"
                  value={c.fecha ?? ''}
                  onChange={(e) => patch(c.id, { fecha: e.target.value || null })}
                  className="bg-transparent text-xs text-zinc-700 outline-none dark:text-zinc-200"
                />
              </label>
              {c.fecha && (
                <button
                  type="button"
                  onClick={() => patch(c.id, { fecha: null })}
                  className="text-xs text-zinc-400 underline-offset-2 hover:underline"
                >
                  quitar fecha
                </button>
              )}
            </div>
            <Interruptor activo={c.cumplida} etiqueta="Ya la ha cumplido" onChange={(v) => patch(c.id, { cumplida: v })} />
            <Interruptor
              activo={c.avisadaEducamos}
              etiqueta="Avisado en Educamos"
              onChange={(v) => patch(c.id, { avisadaEducamos: v })}
            />
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
              <span>
                {c.avisoEnviadoAt ? 'Aviso enviado al tutor/a' : 'Sin aviso por correo'}
                {c.fijadaPorEmail ? ` · fecha puesta por ${c.fijadaPorEmail}` : ''}
              </span>
              <button
                type="button"
                onClick={() => borrar(c)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Consecuencias</h1>
        {puedeCrear && (
          <button
            type="button"
            onClick={() => setCreando((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {creando ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} A mano
          </button>
        )}
      </div>

      {creando && <NuevaConsecuencia onCreada={() => { setCreando(false); refrescar(); }} />}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          Esperando fecha ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Nada pendiente: todas tienen día puesto.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-orange-200 bg-white dark:divide-zinc-800 dark:border-orange-900/40 dark:bg-zinc-900">
            {pendientes.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Con fecha ({puestas.length})</h2>
        {puestas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Todavía ninguna.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {puestas.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Consecuencia a mano: buscar alumno, día y motivo. Sin retrasos detrás. */
function NuevaConsecuencia({ onCreada }: { onCreada: () => void }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<AlumnoBusqueda[]>([]);
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null);
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2 || alumno) {
        setResultados([]);
        return;
      }
      try {
        const res = await fetch(`/api/puntualidad/alumnos?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (vivo) setResultados(res.ok ? (data.alumnos ?? []) : []);
      } catch {
        if (vivo) setResultados([]);
      }
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [query, alumno]);

  const crear = async () => {
    if (!alumno) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/puntualidad/admin/consecuencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eduStudentId: alumno.eduStudentId,
          fecha: fecha || null,
          motivo: motivo.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear');
      toast.success(`Consecuencia creada para ${alumno.nombre}`);
      onCreada();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      {alumno ? (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{alumno.nombre}</span>
          <ClaseChip clase={alumno.clase} />
          <button
            type="button"
            onClick={() => {
              setAlumno(null);
              setQuery('');
              inputRef.current?.focus();
            }}
            className="ml-auto rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cambiar alumno"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Alumno (nombre o apellido)…"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
              {resultados.map((a) => (
                <li key={a.eduStudentId}>
                  <button
                    type="button"
                    onClick={() => setAlumno(a)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-500/5"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                    <ClaseChip clase={a.clase} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
          <CalendarPlus className="h-4 w-4 text-zinc-400" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-transparent text-sm outline-none"
          />
        </label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className="min-w-[12rem] flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          disabled={!alumno || guardando}
          onClick={crear}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
        >
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Crear
        </button>
      </div>
    </div>
  );
}
