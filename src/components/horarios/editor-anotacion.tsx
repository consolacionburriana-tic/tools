'use client';

// Diálogo para anotar algo a mano en un hueco de «Mi horario» (tutoría individual, atención a
// familias, guardia…), o para cambiarlo / quitarlo después. Ficha: docs/20-mi-horario.md
//
// Una hoja como el detalle de una celda del navegador (sube desde abajo en el móvil y sale
// centrada en pantalla grande). Todo lo que se anota se repite cada semana del periodo,
// como cualquier otra hora del horario, y se dice en el propio diálogo para que no sorprenda.

import { useState } from 'react';
import { Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DIAS } from '@/lib/horarios';
import { haptic } from '@/lib/haptics';
import { OPCIONES_ANOTACION, opcionDeActividad } from '@/lib/mihorario-anotaciones';

export interface HuecoAnotable {
  periodoId: string;
  tramoId: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
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
  hueco: Pick<HuecoAnotable, 'dia' | 'horaInicio' | 'horaFin'> & Partial<Pick<HuecoAnotable, 'periodoId' | 'tramoId'>>;
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

  function elegir(o: Opcion) {
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
    <Dialog open onOpenChange={(o) => !o && !ocupado && onCerrar()}>
      <DialogContent variante="hoja">
        <DialogHeader>
          <DialogTitle>{existente ? 'Tu anotación' : 'Añadir a tu horario'}</DialogTitle>
          <DialogDescription className="capitalize tabular-nums">
            {DIAS[hueco.dia - 1]} · {hueco.horaInicio}–{hueco.horaFin}
          </DialogDescription>
        </DialogHeader>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">¿Qué es?</legend>
          <Filtros etiqueta="¿Qué es?">
            {OPCIONES_ANOTACION.map((o) => (
              <Filtro key={o.id} activo={o.id === opcion.id} onClick={() => elegir(o)}>
                {o.nombre}
              </Filtro>
            ))}
          </Filtros>
        </fieldset>

        <div className="space-y-3">
          <Campo etiqueta="Cómo se llama" id="anotacion-etiqueta">
            <Input
              id="anotacion-etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder={opcion.pista}
              maxLength={120}
            />
          </Campo>
          <Campo etiqueta="Dónde" id="anotacion-aula" opcional>
            <Input id="anotacion-aula" value={aula} onChange={(e) => setAula(e.target.value)} placeholder="Aula, despacho…" maxLength={60} />
          </Campo>
          <Campo etiqueta="Notas" id="anotacion-notas" opcional>
            <Textarea id="anotacion-notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} rows={2} />
          </Campo>
        </div>

        <p className="flex items-start gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <Repeat aria-hidden className="mt-0.5 size-4 shrink-0" />
          Se repite todas las semanas de este horario, como el resto. Solo lo ves tú, y sale también si exportas tu horario a Google Calendar.
        </p>

        <DialogFooter>
          {existente && (
            <ConfirmarEnLinea
              etiqueta="Quitar"
              confirmar="Sí, quitar"
              icono={<Trash2 aria-hidden />}
              tamano="default"
              disabled={ocupado}
              className="sm:mr-auto"
              onConfirmar={() => enviar('DELETE')}
            />
          )}
          <Button
            type="button"
            cargando={enviando === 'guardar'}
            disabled={ocupado}
            onClick={() => enviar(existente ? 'PATCH' : 'POST')}
          >
            {existente ? 'Guardar cambios' : 'Añadir a mi horario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
