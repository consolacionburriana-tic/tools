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

import { Filtro, Filtros } from '@/components/ui/filtro';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Interruptor } from '@/components/ui/interruptor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Rotulo } from '@/components/ui/rotulo';
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
          <Etiqueta>{consecuencia.clase}</Etiqueta>
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
          <CalendarCheck aria-hidden className="h-4 w-4 text-zinc-500" /> ¿Qué día se queda sin patio?
        </h2>
        <Filtros etiqueta="Qué día">
          {rapidas.map((r) => (
            <Filtro key={r.valor} activo={fecha === r.valor} onClick={() => setFecha(r.valor)}>
              {r.label}
            </Filtro>
          ))}
          <Input type="date" aria-label="Otro día" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
        </Filtros>
        {fecha && (
          <p className="text-sm capitalize text-zinc-500 dark:text-zinc-400">{fmt(fecha)}</p>
        )}

        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" aria-label="Notas" />

        <Button type="button" size="lg" className="w-full" disabled={guardando} onClick={() => guardar()}>
          {guardando ? <Loader2 className="animate-spin" /> : guardado ? <Check /> : null}
          {guardado ? 'Guardado' : 'Guardar la consecuencia'}
        </Button>
      </div>

      <div className="space-y-2.5">
        <Rotulo as="h2">Seguimiento</Rotulo>
        <Interruptor
          activo={cumplida}
          etiqueta="Ya la ha cumplido"
          descripcion="Se quedó sin patio ese día"
          onChange={(v: boolean) => {
            setCumplida(v);
            void guardar({ cumplida: v });
          }}
        />
        <Interruptor
          activo={avisada}
          etiqueta="Avisado en Educamos"
          descripcion="La familia ya tiene el aviso puesto"
          onChange={(v: boolean) => {
            setAvisada(v);
            void guardar({ avisadaEducamos: v });
          }}
        />
      </div>
    </div>
  );
}
