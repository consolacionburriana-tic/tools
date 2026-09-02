'use client';

// Pantalla del enlace del correo: el tutor ve por qué hay consecuencia y pone el día en
// dos toques (mañana / pasado / otro día). Después, los dos interruptores de seguimiento:
// si ya se cumplió y si está avisado en Educamos.
//
// Vive sin login a propósito (el token del enlace es la credencial), pero es la MISMA
// pantalla que se usa desde dentro del panel: solo cambia de dónde viene el `endpoint`.
import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Chip, ClaseChip, Interruptor } from './ui';
import { haptic } from '@/lib/haptics';

export interface ConsecuenciaVista {
  id: string;
  alumno: string;
  clase: string;
  motivo: string | null;
  fecha: string | null;
  notas: string | null;
  cumplida: boolean;
  avisadaEducamos: boolean;
  retrasos: { fecha: string; hora: string; asignatura: string | null; profe: string | null }[];
}

const fmt = (iso: string, patron = "EEEE d 'de' MMMM") => {
  try {
    return format(parseISO(iso), patron, { locale: es });
  } catch {
    return iso;
  }
};

export function ConsecuenciaForm({
  consecuencia,
  endpoint,
}: {
  consecuencia: ConsecuenciaVista;
  endpoint: string;
}) {
  const hoy = new Date();
  const [fecha, setFecha] = useState(consecuencia.fecha ?? '');
  const [notas, setNotas] = useState(consecuencia.notas ?? '');
  const [cumplida, setCumplida] = useState(consecuencia.cumplida);
  const [avisada, setAvisada] = useState(consecuencia.avisadaEducamos);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const rapidas = [
    { label: 'Hoy', valor: format(hoy, 'yyyy-MM-dd') },
    { label: 'Mañana', valor: format(addDays(hoy, 1), 'yyyy-MM-dd') },
    { label: 'Pasado', valor: format(addDays(hoy, 2), 'yyyy-MM-dd') },
  ];

  const guardar = async (cambios?: { cumplida?: boolean; avisadaEducamos?: boolean }) => {
    setGuardando(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fecha || null,
          notas: notas || null,
          cumplida: cambios?.cumplida ?? cumplida,
          avisadaEducamos: cambios?.avisadaEducamos ?? avisada,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      await haptic.success();
      setGuardado(true);
      toast.success('Guardado, gracias');
    } catch (error) {
      await haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{consecuencia.alumno}</h1>
          <ClaseChip clase={consecuencia.clase} />
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {consecuencia.motivo ?? 'Acumula tres retrasos sin justificar.'} Le corresponde quedarse sin patio.
        </p>

        {consecuencia.retrasos.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            {consecuencia.retrasos.map((r, i) => (
              <li key={`${r.fecha}-${i}`} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <span className="w-40 shrink-0 capitalize text-zinc-700 dark:text-zinc-200">{fmt(r.fecha, 'EEE d MMM')}</span>
                <span className="tabular-nums text-zinc-500">{r.hora}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-400">{r.asignatura ?? 'sin asignatura'}</span>
                {r.profe && <span className="hidden shrink-0 text-xs text-zinc-400 sm:block">{r.profe}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <CalendarCheck className="h-4 w-4 text-orange-500" /> ¿Qué día se queda sin patio?
        </h2>
        <div className="flex flex-wrap gap-2">
          {rapidas.map((r) => (
            <Chip key={r.valor} activo={fecha === r.valor} onClick={() => setFecha(r.valor)}>
              {r.label}
            </Chip>
          ))}
          <label className="flex h-[44px] items-center rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-sm text-zinc-800 outline-none dark:text-zinc-100"
            />
          </label>
        </div>
        {fecha && (
          <p className="text-sm capitalize text-zinc-500 dark:text-zinc-400">{fmt(fecha)}</p>
        )}

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Notas (opcional)"
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800"
        />

        <button
          type="button"
          disabled={guardando}
          onClick={() => guardar()}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-base font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
        >
          {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : guardado ? <Check className="h-5 w-5" /> : null}
          {guardado ? 'Guardado' : 'Guardar la consecuencia'}
        </button>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider text-zinc-400">Seguimiento</p>
        <Interruptor
          activo={cumplida}
          etiqueta="Ya la ha cumplido"
          descripcion="Se quedó sin patio ese día"
          onChange={(v) => {
            setCumplida(v);
            void guardar({ cumplida: v });
          }}
        />
        <Interruptor
          activo={avisada}
          etiqueta="Avisado en Educamos"
          descripcion="La familia ya tiene el aviso puesto"
          onChange={(v) => {
            setAvisada(v);
            void guardar({ avisadaEducamos: v });
          }}
        />
      </div>
    </div>
  );
}
