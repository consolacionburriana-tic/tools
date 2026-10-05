'use client';

// ⚙️ Ajustes: los tipos de momento (objetivo, calendario, texto del correo, a qué clases va),
// los trimestres del curso y el «acceso común» del claustro.
import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { nombreClase } from '@/lib/cursos';
import { claveClase, clasesDeTipo, ETAPA_LABELS, ETAPAS_ORA, FRECUENCIA_LABELS, FRECUENCIAS, fechaCorta, type EntradaTipo, type TipoMomento, type Trimestre } from '@/lib/oratorios';
import { Accion, api, Pastilla } from './comun';
import type { Estado } from './panel';

const campo = 'min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

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
        <h3 className="text-sm font-semibold">Tipos de momento</h3>
        <ul className="space-y-2">
          {e.tipos.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setEditando(t)}
                className={cn('flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800', !t.activo && 'opacity-50')}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.nombre}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {t.cantidad} {FRECUENCIA_LABELS[t.frecuencia]} · {t.clases?.length ? `${t.clases.length} clases` : t.etapas.map((x) => ETAPA_LABELS[x]).filter(Boolean).join(' + ') || '—'} · aviso {t.avisoDias} días antes ·{' '}
                    {t.calendarioId ? 'con calendario' : 'sin calendario'}
                  </span>
                </span>
                <Pencil className="h-4 w-4 text-zinc-400" />
              </button>
            </li>
          ))}
        </ul>
        <Accion onClick={() => setEditando('nuevo')}>
          <Plus className="h-4 w-4" /> Nuevo tipo
        </Accion>
      </section>

      {/* Trimestres */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Trimestres {e.ajustes.academicYear} {!e.ajustes.guardados && <span className="font-normal text-amber-600">· propuestos, sin guardar</span>}
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {trimestres.map((t, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-1 text-xs font-semibold text-zinc-500">T{i + 1}</p>
              <div className="flex items-center gap-1">
                <input type="date" value={t.inicio} onChange={(ev) => setTrimestres(trimestres.map((x, j) => (j === i ? { ...x, inicio: ev.target.value } : x)))} className={campo} />
                <input type="date" value={t.fin} onChange={(ev) => setTrimestres(trimestres.map((x, j) => (j === i ? { ...x, fin: ev.target.value } : x)))} className={campo} />
              </div>
            </div>
          ))}
        </div>
        {(cambiados || !e.ajustes.guardados) && (
          <Accion tono="azul" disabled={guardando} onClick={() => void guardarAjustes({ trimestres })}>
            <Check className="h-4 w-4" /> Guardar trimestres
          </Accion>
        )}
        <p className="text-xs text-zinc-500">
          Fuera de trimestre no se planifica. Festivos: los del centro ({e.datos.festivos.length}), de Mi horario.
          {e.datos.festivos.length > 0 && ` ${e.datos.festivos.map((f) => fechaCorta(f.inicio)).join(' · ')}`}
        </p>
      </section>

      {/* Acceso común */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Acceso del claustro</h3>
        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={e.ajustes.accesoComun}
            disabled={guardando}
            onChange={(ev) => void guardarAjustes({ accesoComun: ev.target.checked })}
          />
          <span className="text-sm">
            <b>Cada profe ve lo suyo</b>
            <span className="block text-zinc-500">Las sesiones confirmadas que le quitan una hora (o que lleva). Nunca los borradores.</span>
          </span>
        </label>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{tipo ? `${tipo.emoji} ${tipo.nombre}` : 'Nuevo tipo'}</DialogTitle>
        <div className="grid grid-cols-4 gap-2">
          <label className="text-xs text-zinc-500">
            Emoji
            <input value={f.emoji} onChange={(ev) => set('emoji', ev.target.value)} className={cn(campo, 'text-center text-lg')} />
          </label>
          <label className="col-span-3 text-xs text-zinc-500">
            Nombre (título del evento)
            <input value={f.nombre} onChange={(ev) => set('nombre', ev.target.value)} placeholder="Taller de robótica" className={campo} />
          </label>
          <label className="col-span-4 text-xs text-zinc-500">
            En el correo: «un momento de …»
            <input value={f.nombreCorreo} onChange={(ev) => set('nombreCorreo', ev.target.value)} placeholder={f.nombre.toLowerCase()} className={campo} />
          </label>
          <label className="text-xs text-zinc-500">
            Objetivo
            <input type="number" min={1} max={20} value={f.cantidad} onChange={(ev) => set('cantidad', Number(ev.target.value) || 1)} className={campo} />
          </label>
          <label className="col-span-3 text-xs text-zinc-500">
            por clase
            <select value={f.frecuencia} onChange={(ev) => set('frecuencia', ev.target.value as EntradaTipo['frecuencia'])} className={campo}>
              {FRECUENCIAS.map((x) => (
                <option key={x} value={x}>
                  {FRECUENCIA_LABELS[x]}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-4 space-y-1">
            <p className="text-xs text-zinc-500">Clases</p>
            <div className="flex flex-wrap gap-1.5">
              {ETAPAS_ORA.map((et) => (
                <Pastilla key={et} activa={f.etapas.includes(et)} onClick={() => set('etapas', f.etapas.includes(et) ? f.etapas.filter((x) => x !== et) : [...f.etapas, et])}>
                  {ETAPA_LABELS[et]}
                </Pastilla>
              ))}
              <Pastilla activa={fijas} onClick={() => set('clases', fijas ? null : automaticas)} title="Elegir clase a clase">
                Elegir a mano
              </Pastilla>
            </div>
            {fijas && (
              <div className="flex flex-wrap gap-1">
                {e.datos.clases.map((c) => {
                  const k = claveClase(c);
                  const on = f.clases!.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set('clases', on ? f.clases!.filter((x) => x !== k) : [...f.clases!, k])}
                      className={cn('rounded-md border px-2 py-1 text-xs', on ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-200 dark:border-zinc-700')}
                    >
                      {nombreClase(c.curso, c.letra)}
                    </button>
                  );
                })}
              </div>
            )}
            {!fijas && <p className="text-[11px] text-zinc-400">{automaticas.length} clases</p>}
          </div>
          <label className="col-span-4 text-xs text-zinc-500">
            Calendario de Google (id)
            <input value={f.calendarioId ?? ''} onChange={(ev) => set('calendarioId', ev.target.value || null)} placeholder="c_…@group.calendar.google.com" className={cn(campo, 'font-mono text-xs')} />
          </label>
          <label className="col-span-4 text-xs text-zinc-500">
            Texto extra del correo
            <textarea value={f.textoCorreo ?? ''} onChange={(ev) => set('textoCorreo', ev.target.value || null)} rows={3} className={cn(campo, 'py-1.5')} />
          </label>
          <label className="col-span-4 flex items-start gap-3 rounded-xl border border-zinc-200 p-2 text-sm dark:border-zinc-700">
            <input type="checkbox" checked={f.sinRepetir} onChange={(ev) => set('sinRepetir', ev.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <b>Que no se repita una sesión en la vida escolar del alumno</b>
              <span className="block text-xs text-zinc-500">
                Al elegir la sesión de cada momento, las que ya vieron los alumnos de esa clase (este curso o antes) salen avisadas y no se proponen solas.
              </span>
            </span>
          </label>
          <label className="col-span-2 text-xs text-zinc-500">
            Aviso, días antes
            <input type="number" min={0} max={60} value={f.avisoDias} onChange={(ev) => set('avisoDias', Number(ev.target.value) || 0)} className={campo} />
          </label>
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(ev) => set('activo', ev.target.checked)} className="h-5 w-5" /> Activo
          </label>
        </div>
        <Accion tono="azul" disabled={guardando || !f.nombre.trim()} onClick={guardar}>
          <Check className="h-4 w-4" /> Guardar
        </Accion>
      </DialogContent>
    </Dialog>
  );
}
