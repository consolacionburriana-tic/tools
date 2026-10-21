'use client';

// Ajustes: los tipos de momento (objetivo, calendario, texto del correo, a qué clases va),
// los trimestres del curso y el «acceso común» del claustro.
import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Selector } from '@/components/ui/selector';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ETAPAS_VISIBLES, nombreClase } from '@/lib/cursos';
import { claveClase, clasesDeTipo, ETAPA_LABELS, FRECUENCIA_LABELS, FRECUENCIAS, fechaCorta, type EntradaTipo, type TipoMomento, type Trimestre } from '@/lib/oratorios';
import { api } from './comun';
import type { Estado } from './panel';

export function Ajustes({ e }: { e: Estado }) {
  const [editando, setEditando] = useState<TipoMomento | 'nuevo' | null>(null);
  const [trimestres, setTrimestres] = useState<Trimestre[]>(e.ajustes.trimestres);
  const [guardando, setGuardando] = useState(false);
  const cambiados = JSON.stringify(trimestres) !== JSON.stringify(e.ajustes.trimestres);

  async function guardarAjustes(cambios: { trimestres?: Trimestre[]; accesoComun?: boolean }) {
    setGuardando(true);
    try {
      const a = await api.ajustes(e.ajustes.academicYear, cambios);
      e.setAjustes(a);
      setTrimestres(a.trimestres);
      haptic.success();
      toast.success('Guardado');
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tipos */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Tipos de momento</h2>
        <ul className="space-y-2">
          {e.tipos.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setEditando(t)}
                className={cn(claseTarjeta, 'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800', !t.activo && 'opacity-60')}
              >
                <span aria-hidden className="text-2xl">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {t.nombre}
                    {!t.activo && <span className="ml-2 text-sm font-normal text-zinc-500">· inactivo</span>}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {t.cantidad} {FRECUENCIA_LABELS[t.frecuencia]} · {t.clases?.length ? `${t.clases.length} clases` : t.etapas.map((x) => ETAPA_LABELS[x]).join(' + ') || '—'} · aviso {t.avisoDias} días antes ·{' '}
                    {t.calendarioId ? 'con calendario' : 'sin calendario'}
                  </span>
                </span>
                <Pencil className="h-4 w-4 text-zinc-500" aria-label="Editar" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={() => setEditando('nuevo')}>
          <Plus /> Nuevo tipo
        </Button>
      </section>

      {/* Trimestres */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          Trimestres {e.ajustes.academicYear} {!e.ajustes.guardados && <span className="text-sm font-normal text-amber-700 dark:text-amber-400">· propuestos, sin guardar</span>}
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {trimestres.map((t, i) => (
            <div key={i} className={cn(claseTarjeta, 'p-3')}>
              <p className="mb-1 text-xs font-semibold text-zinc-500">T{i + 1}</p>
              <div className="flex flex-col gap-2">
                <Input type="date" aria-label={`Inicio del T${i + 1}`} value={t.inicio} onChange={(ev) => setTrimestres(trimestres.map((x, j) => (j === i ? { ...x, inicio: ev.target.value } : x)))} />
                <Input type="date" aria-label={`Fin del T${i + 1}`} value={t.fin} onChange={(ev) => setTrimestres(trimestres.map((x, j) => (j === i ? { ...x, fin: ev.target.value } : x)))} />
              </div>
            </div>
          ))}
        </div>
        {(cambiados || !e.ajustes.guardados) && (
          <Button cargando={guardando} onClick={() => void guardarAjustes({ trimestres })}>
            {!guardando && <Check />} Guardar trimestres
          </Button>
        )}
        <p className="text-xs text-zinc-500">
          Fuera de trimestre no se planifica. Festivos: los del centro ({e.datos.festivos.length}), de Mi horario.
          {e.datos.festivos.length > 0 && ` ${e.datos.festivos.map((f) => fechaCorta(f.inicio)).join(' · ')}`}
        </p>
      </section>

      {/* Acceso común */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Acceso del claustro</h2>
        <div className={cn(claseTarjeta, 'p-3')}>
          <Interruptor
            activo={e.ajustes.accesoComun}
            disabled={guardando}
            onChange={(v) => void guardarAjustes({ accesoComun: v })}
            etiqueta="Cada profe ve lo suyo"
            descripcion="Las sesiones confirmadas que le quitan una hora (o que lleva). Nunca los borradores."
          />
        </div>
      </section>

      {editando && (
        <EditorTipo
          e={e}
          tipo={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function EditorTipo({ e, tipo, onClose }: { e: Estado; tipo: TipoMomento | null; onClose: () => void }) {
  const [f, setF] = useState<EntradaTipo>(
    tipo
      ? {
          codigo: tipo.codigo,
          nombre: tipo.nombre,
          nombreCorreo: tipo.nombreCorreo,
          emoji: tipo.emoji,
          calendarioId: tipo.calendarioId,
          frecuencia: tipo.frecuencia,
          cantidad: tipo.cantidad,
          etapas: tipo.etapas as EntradaTipo['etapas'],
          clases: tipo.clases,
          textoCorreo: tipo.textoCorreo,
          avisoDias: tipo.avisoDias,
          sinRepetir: tipo.sinRepetir,
          activo: tipo.activo,
        }
      : { codigo: '', nombre: '', nombreCorreo: '', emoji: '✨', calendarioId: null, frecuencia: 'trimestre', cantidad: 1, etapas: ['ESO'], clases: null, textoCorreo: null, avisoDias: 7, sinRepetir: true, activo: true },
  );
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof EntradaTipo>(k: K, v: EntradaTipo[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const fijas = f.clases !== null;
  const automaticas = clasesDeTipo({ etapas: f.etapas, clases: null }, e.datos.clases).map(claveClase);

  async function guardar() {
    setGuardando(true);
    try {
      const codigo = f.codigo || f.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const guardado = await api.tipo(tipo?.id ?? null, { ...f, codigo, nombreCorreo: f.nombreCorreo || f.nombre.toLowerCase() });
      e.setTipos(tipo ? e.tipos.map((t) => (t.id === guardado.id ? guardado : t)) : [...e.tipos, guardado]);
      haptic.success();
      toast.success(`Guardado: ${guardado.nombre}`);
      onClose();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="pr-10">{tipo ? `${tipo.emoji} ${tipo.nombre}` : 'Nuevo tipo'}</DialogTitle>
        <div className="grid grid-cols-4 gap-3">
          <Campo etiqueta="Emoji" id="ora-tipo-emoji">
            <Input id="ora-tipo-emoji" value={f.emoji} onChange={(ev) => set('emoji', ev.target.value)} className="text-center text-lg" />
          </Campo>
          <Campo etiqueta="Nombre (título del evento)" id="ora-tipo-nombre" className="col-span-3">
            <Input id="ora-tipo-nombre" value={f.nombre} onChange={(ev) => set('nombre', ev.target.value)} placeholder="Taller de robótica" />
          </Campo>
          <Campo etiqueta="En el correo: «un momento de …»" id="ora-tipo-correo" className="col-span-4">
            <Input id="ora-tipo-correo" value={f.nombreCorreo} onChange={(ev) => set('nombreCorreo', ev.target.value)} placeholder={f.nombre.toLowerCase()} />
          </Campo>
          <Campo etiqueta="Objetivo" id="ora-tipo-cantidad">
            <Input id="ora-tipo-cantidad" type="number" min={1} max={20} value={f.cantidad} onChange={(ev) => set('cantidad', Number(ev.target.value) || 1)} />
          </Campo>
          <Campo etiqueta="por clase" id="ora-tipo-frecuencia" className="col-span-3">
            <Selector id="ora-tipo-frecuencia" value={f.frecuencia} onChange={(ev) => set('frecuencia', ev.target.value as EntradaTipo['frecuencia'])}>
              {FRECUENCIAS.map((x) => (
                <option key={x} value={x}>
                  {FRECUENCIA_LABELS[x]}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="col-span-4 space-y-1.5">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Clases</p>
            <Filtros etiqueta="Etapas">
              {ETAPAS_VISIBLES.map((et) => (
                <Filtro key={et} activo={f.etapas.includes(et)} onClick={() => set('etapas', f.etapas.includes(et) ? f.etapas.filter((x) => x !== et) : [...f.etapas, et])}>
                  {ETAPA_LABELS[et]}
                </Filtro>
              ))}
              <Filtro activo={fijas} onClick={() => set('clases', fijas ? null : automaticas)}>
                Elegir clase a clase
              </Filtro>
            </Filtros>
            {fijas && (
              <Filtros etiqueta="Clases elegidas">
                {e.datos.clases.map((c) => {
                  const k = claveClase(c);
                  const on = f.clases!.includes(k);
                  return (
                    <Filtro key={k} activo={on} onClick={() => set('clases', on ? f.clases!.filter((x) => x !== k) : [...f.clases!, k])}>
                      {nombreClase(c.curso, c.letra)}
                    </Filtro>
                  );
                })}
              </Filtros>
            )}
            {!fijas && <p className="text-xs text-zinc-500">{automaticas.length} clases</p>}
          </div>
          <Campo etiqueta="Calendario de Google (id)" id="ora-tipo-calendario" className="col-span-4">
            <Input id="ora-tipo-calendario" value={f.calendarioId ?? ''} onChange={(ev) => set('calendarioId', ev.target.value || null)} placeholder="c_…@group.calendar.google.com" className="font-mono text-sm sm:text-sm" />
          </Campo>
          <Campo etiqueta="Texto extra del correo" id="ora-tipo-texto" className="col-span-4">
            <Textarea id="ora-tipo-texto" value={f.textoCorreo ?? ''} onChange={(ev) => set('textoCorreo', ev.target.value || null)} rows={3} />
          </Campo>
          <div className="col-span-4">
            <Interruptor
              activo={f.sinRepetir}
              onChange={(v) => set('sinRepetir', v)}
              etiqueta="Que no se repita una sesión en la vida escolar del alumno"
              descripcion="Al elegir la sesión de cada momento, las que ya vieron los alumnos de esa clase (este curso o antes) salen avisadas y no se proponen solas."
            />
          </div>
          <Campo etiqueta="Aviso, días antes" id="ora-tipo-aviso" className="col-span-2">
            <Input id="ora-tipo-aviso" type="number" min={0} max={60} value={f.avisoDias} onChange={(ev) => set('avisoDias', Number(ev.target.value) || 0)} />
          </Campo>
          <div className="col-span-2 flex items-end">
            <Interruptor activo={f.activo} onChange={(v) => set('activo', v)} etiqueta="Activo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!f.nombre.trim()} cargando={guardando} onClick={guardar}>
            {!guardando && <Check />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
