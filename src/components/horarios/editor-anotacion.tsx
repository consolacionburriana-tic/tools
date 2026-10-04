'use client';

// Diálogo para anotar algo a mano en un hueco de «Mi horario» (tutoría individual, atención a
// familias, guardia…), o para cambiarlo / quitarlo después. Ficha: docs/20-mi-horario.md
//
// Mismo patrón de overlay que el detalle de una celda del navegador (hoja desde abajo en el
// iPad, centrada en pantalla grande). Todo lo que se anota se repite cada semana del periodo,
// como cualquier otra hora del horario, y se dice en el propio diálogo para que no sorprenda.

import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Repeat, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DIAS } from '@/lib/horarios';
import { haptic } from '@/lib/haptics';
import { OPCIONES_ANOTACION, opcionDeActividad } from '@/lib/mihorario-anotaciones';
import { cn } from '@/lib/utils';

export interface HuecoAnotable {
  periodoId: string;
  tramoId: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
  /** 'Patio', 'Comedor'… cuando el hueco no es una hora lectiva. */
  lugar?: string | null;
  /** El hueco ya tiene algo y lo que se anote convive con ello (una codocencia, por ejemplo). */
  sumar?: boolean;
}

/** Lo que hace falta de una anotación ya existente para reabrirla. */
export interface AnotacionExistente {
  sesionId: string;
  actividad: string;
  etiqueta: string | null;
  aula: string | null;
  notas: string | null;
}

type Opcion = (typeof OPCIONES_ANOTACION)[number];

export function EditorAnotacion({
  hueco,
  existente,
  onCerrar,
  onGuardado,
}: {
  hueco: Pick<HuecoAnotable, 'dia' | 'horaInicio' | 'horaFin'> & Partial<Pick<HuecoAnotable, 'periodoId' | 'tramoId' | 'lugar' | 'sumar'>>;
  existente?: AnotacionExistente;
  onCerrar: () => void;
  /** Se llama tras guardar o quitar con éxito, para que quien pinta recargue el horario. */
  onGuardado: () => void;
}) {
  const [opcion, setOpcion] = useState<Opcion>(() => (existente ? opcionDeActividad(existente.actividad) : null) ?? OPCIONES_ANOTACION[0]);
  const [etiqueta, setEtiqueta] = useState(existente ? (existente.etiqueta ?? '') : (OPCIONES_ANOTACION[0].etiqueta ?? ''));
  const [aula, setAula] = useState(existente?.aula ?? '');
  const [notas, setNotas] = useState(existente?.notas ?? '');
  const [enviando, setEnviando] = useState<'guardar' | 'quitar' | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  function elegir(o: Opcion) {
    haptic.tap();
    // El texto propuesto acompaña a la opción mientras no lo hayas tocado: si cambias de
    // «Tutoría individual» a «Reunión» no te queda «Tutoría individual» escrito.
    if (etiqueta === (opcion.etiqueta ?? '')) setEtiqueta(o.etiqueta ?? '');
    setOpcion(o);
  }

  async function enviar(metodo: 'POST' | 'PATCH' | 'DELETE') {
    setEnviando(metodo === 'DELETE' ? 'quitar' : 'guardar');
    try {
      const cuerpo =
        metodo === 'DELETE'
          ? { sesionId: existente!.sesionId }
          : metodo === 'PATCH'
            ? { sesionId: existente!.sesionId, actividad: opcion.actividad, etiqueta, aula, notas }
            : { periodoId: hueco.periodoId, tramoId: hueco.tramoId, actividad: opcion.actividad, etiqueta, aula, notas };
      const res = await fetch('/api/mi-horario/anotaciones', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      // Una respuesta que no es JSON (timeout de la plataforma, sesión caducada) no debe
      // reventar con un «Unexpected token <»: se traduce a lo que ha pasado.
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        haptic.warning();
        toast.error(json?.error ?? 'No se ha podido guardar. Prueba otra vez.');
        return;
      }
      haptic.success();
      toast.success(metodo === 'DELETE' ? 'Quitado de tu horario' : existente ? 'Cambios guardados' : 'Añadido a tu horario');
      onGuardado();
    } catch {
      haptic.warning();
      toast.error('Sin conexión. Prueba otra vez.');
    } finally {
      setEnviando(null);
    }
  }

  const ocupado = enviando !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={ocupado ? undefined : onCerrar}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label={existente ? 'Editar anotación' : 'Añadir a tu horario'}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {existente ? 'Tu anotación' : hueco.sumar ? 'Añadir otra cosa' : 'Añadir a tu horario'}
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="capitalize">{DIAS[hueco.dia - 1]}</span> · {hueco.lugar ? `${hueco.lugar} · ` : ''}
              {hueco.horaInicio}–{hueco.horaFin}
            </p>
            {hueco.sumar && !existente && (
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Se suma a lo que ya tienes a esta hora.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mb-4">
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">¿Qué es?</legend>
          <div className="flex flex-wrap gap-1.5">
            {OPCIONES_ANOTACION.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={o.id === opcion.id}
                onClick={() => elegir(o)}
                className={cn(
                  'min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors',
                  o.id === opcion.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-200'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
                )}
              >
                {o.nombre}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Cómo se llama</span>
            <Input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder={opcion.pista}
              maxLength={120}
              className="h-11 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Dónde</span>
            <Input value={aula} onChange={(e) => setAula(e.target.value)} placeholder="Aula, despacho… (opcional)" maxLength={60} className="h-11 text-base" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Notas</span>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" maxLength={500} rows={2} className="text-base" />
          </label>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Se repite todas las semanas de este horario, como el resto. Solo lo ves tú, y sale también si exportas tu horario a Google Calendar.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => enviar(existente ? 'PATCH' : 'POST')} disabled={ocupado} className="h-11 flex-1 bg-indigo-600 px-5 text-base text-white hover:bg-indigo-700">
            {enviando === 'guardar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {existente ? 'Guardar cambios' : 'Añadir'}
          </Button>
          {existente &&
            (confirmarQuitar ? (
              <Button type="button" variant="destructive" onClick={() => enviar('DELETE')} disabled={ocupado} className="h-11 px-4">
                {enviando === 'quitar' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                Sí, quitar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => { haptic.warning(); setConfirmarQuitar(true); }} disabled={ocupado} className="h-11 px-4">
                <Trash2 className="mr-1.5 h-4 w-4" /> Quitar
              </Button>
            ))}
        </div>
      </motion.div>
    </div>
  );
}
