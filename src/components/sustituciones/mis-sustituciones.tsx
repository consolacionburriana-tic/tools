'use client';

// «Mis sustituciones» (docs/32, decisión 16; abierta a todo el claustro el 23-nov-2026): lo que me
// toca cubrir hoy y los próximos días, grande y claro para no olvidarlo, con «Confirmar» (lo mismo que
// el enlace del correo) y el botón de calendario con «+» (lo añade a su Google Calendar). Solo sale lo que ya me han avisado por correo.
import { useState } from 'react';
import { CalendarPlus, Check, CheckCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { enlaceGoogleCalendar, fechaLarga, hora, lugarDe, mayuscula } from '@/lib/sustituciones';
import type { MiSustitucion } from '@/lib/sustituciones-server';
import { Button, buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { cn } from '@/lib/utils';
import { pedir } from './comun';

export function TarjetaMia({ s, hoy }: { s: MiSustitucion; hoy: string }) {
  const [confirmada, setConfirmada] = useState(Boolean(s.confirmada));
  const [cargando, setCargando] = useState(false);
  const esHoy = s.fecha === hoy;
  const lugar = lugarDe(s);

  async function confirmar() {
    setCargando(true);
    try {
      await pedir('/api/sustituciones/mias/confirmar', { body: { sesionId: s.id } });
      haptic.success();
      setConfirmada(true);
      toast.success('¡Gracias! Confirmada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido confirmar');
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta className={cn('space-y-3 p-4 sm:p-5', esHoy && 'border-blue-300 dark:border-blue-500/50')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-100">
            {hora(s.horaInicio)} <span className="text-zinc-400">–</span> {hora(s.horaFin)}
          </p>
          {s.tramo && <p className="text-sm text-zinc-500 dark:text-zinc-400">{s.tramo} hora</p>}
        </div>
        {confirmada ? (
          <Estado tono="ok" icono={<CheckCheck aria-hidden />}>
            Confirmada
          </Estado>
        ) : (
          <Estado tono="info">Falta que confirmes</Estado>
        )}
      </div>
      {lugar && (
        <p className="flex items-start gap-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-zinc-500" />
          {lugar}
        </p>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{s.enAula ? `Ya estás en el aula: te quedas con el grupo (falta ${s.cubreA}).` : `Cubres a ${s.cubreA}.`}</p>
      {s.indicaciones && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm whitespace-pre-line text-blue-950 dark:bg-blue-500/10 dark:text-blue-100">{s.indicaciones}</p>}
      <div className="flex flex-wrap gap-2">
        {!confirmada && (
          <Button onClick={() => void confirmar()} cargando={cargando}>
            <Check aria-hidden /> Confirmar
          </Button>
        )}
        <a
          href={enlaceGoogleCalendar({ titulo: `Sustitución · ${[s.grupos, s.materia].filter(Boolean).join(' · ') || s.cubreA}`, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, lugar: s.aula ? mayuscula(s.aula) : s.grupos, detalles: [`Cubres a ${s.cubreA}.`, s.indicaciones].filter(Boolean).join('\n\n') })}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Añadir a mi Google Calendar"
          title="Añadir a mi Google Calendar"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <CalendarPlus aria-hidden />
        </a>
      </div>
    </Tarjeta>
  );
}

/** «Hoy», «Mañana» o «Jueves 26 de noviembre». */
export function rotuloDiaMio(fecha: string, hoy: string, manana: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';
  return mayuscula(fechaLarga(fecha));
}
