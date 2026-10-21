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
import { ChevronDown, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta, Tarjeta } from '@/components/ui/tarjeta';
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
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/gestion/puntualidad/alumno/${c.eduStudentId}`}
                className="truncate rounded text-sm font-medium text-zinc-900 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-100"
              >
                {c.alumno}
              </Link>
              <Etiqueta>{c.clase}</Etiqueta>
              {c.origen === 'manual' && <Etiqueta>a mano</Etiqueta>}
            </div>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {c.fecha ? `Sin patio el ${fmt(c.fecha)}` : 'Sin fecha todavía'}
              {c.motivo ? ` · ${c.motivo}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {c.cumplida && (
              <Estado tono="ok" className="hidden sm:inline-flex">
                Cumplida
              </Estado>
            )}
            {c.avisadaEducamos && (
              <Estado tono="info" className="hidden sm:inline-flex">
                Avisada en Educamos
              </Estado>
            )}
            {ocupado === c.id ? (
              <span className="flex size-10 items-center justify-center">
                <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-500" />
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setAbierta(abierta === c.id ? null : c.id)}
                aria-expanded={abierta === c.id}
                aria-label={`Abrir la consecuencia de ${c.alumno}`}
              >
                <ChevronDown className={cn('transition-transform', abierta === c.id && 'rotate-180')} />
              </Button>
            )}
          </div>
        </div>

        {abierta === c.id && (
          <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
            {(c.cumplida || c.avisadaEducamos) && (
              <div className="flex flex-wrap gap-1.5 sm:hidden">
                {c.cumplida && <Estado tono="ok">Cumplida</Estado>}
                {c.avisadaEducamos && <Estado tono="info">Avisada en Educamos</Estado>}
              </div>
            )}
            {c.retrasos.length > 0 && (
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
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
              <Filtros etiqueta="Día sin patio">
                {rapidas.map((r) => (
                  <Filtro key={r.valor} activo={c.fecha === r.valor} onClick={() => patch(c.id, { fecha: r.valor })}>
                    {r.label}
                  </Filtro>
                ))}
              </Filtros>
              <Input
                type="date"
                value={c.fecha ?? ''}
                onChange={(e) => patch(c.id, { fecha: e.target.value || null })}
                aria-label="Otro día"
                className="h-10 w-auto"
              />
              {c.fecha && (
                <Button type="button" variant="ghost" size="sm" onClick={() => patch(c.id, { fecha: null })}>
                  Quitar fecha
                </Button>
              )}
            </div>
            <Interruptor activo={c.cumplida} etiqueta="Ya la ha cumplido" onChange={(v) => patch(c.id, { cumplida: v })} />
            <Interruptor
              activo={c.avisadaEducamos}
              etiqueta="Avisado en Educamos"
              onChange={(v) => patch(c.id, { avisadaEducamos: v })}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {c.avisoEnviadoAt ? 'Aviso enviado al tutor/a' : 'Sin aviso por correo'}
                {c.fijadaPorEmail ? ` · fecha puesta por ${c.fijadaPorEmail}` : ''}
              </span>
              <ConfirmarEnLinea
                etiqueta="Borrar"
                icono={<Trash2 />}
                pregunta={`¿Borrar la consecuencia de ${c.alumno}?`}
                onConfirmar={() => borrar(c)}
              />
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Consecuencias</h1>
      {puedeCrear && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
            {creando ? <X aria-hidden /> : <Plus aria-hidden />} {creando ? 'Cerrar' : 'Poner una a mano'}
          </Button>
        </div>
      )}

      {creando && <NuevaConsecuencia onCreada={() => { setCreando(false); refrescar(); }} />}

      <section className="space-y-2">
        <Rotulo className="flex items-center gap-2 px-1">
          Esperando fecha
          {pendientes.length > 0 && <Estado tono="aviso">{pendientes.length}</Estado>}
        </Rotulo>
        {pendientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Nada pendiente: todas tienen día puesto.
          </p>
        ) : (
          <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
            {pendientes.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <Rotulo className="px-1">Con fecha · {puestas.length}</Rotulo>
        {puestas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Todavía ninguna.
          </p>
        ) : (
          <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
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
    <Tarjeta className="space-y-3 p-4">
      {alumno ? (
        <div className="flex min-h-11 items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{alumno.nombre}</span>
          <Etiqueta>{alumno.clase}</Etiqueta>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setAlumno(null);
              setQuery('');
              inputRef.current?.focus();
            }}
            className="ml-auto"
            aria-label="Cambiar de alumno"
          >
            <X />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar alumno"
              placeholder="Alumno (nombre o apellido)…"
              className="pl-10"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
              {resultados.map((a) => (
                <li key={a.eduStudentId}>
                  <button
                    type="button"
                    onClick={() => setAlumno(a)}
                    className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                    <Etiqueta>{a.clase}</Etiqueta>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-label="Día sin patio (opcional)"
          className="w-auto"
        />
        <Input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-label="Motivo"
          placeholder="Motivo (opcional)"
          className="min-w-48 flex-1"
        />
        <Button type="button" disabled={!alumno} cargando={guardando} onClick={crear}>
          Crear consecuencia
        </Button>
      </div>
    </Tarjeta>
  );
}
