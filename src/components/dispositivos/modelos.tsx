'use client';

// Pestaña «Modelos»: el catálogo corto de modelos estándar (David, 20-oct-2026: «que sean
// estándar, 9.ª generación 64 GB…»), para que nadie escriba el mismo modelo de cinco maneras.
// Un modelo en uso no se borra: se archiva y deja de ofrecerse.
import { useState } from 'react';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import type { ModeloDis } from '@/lib/dispositivos-server';
import type { Acciones } from './panel';
import { pedir } from './comun';
import { buttonVariants } from '@/components/ui/button';
import { claseCampo } from '@/components/ui/input';

export function Modelos({ modelos, acciones }: { modelos: ModeloDis[]; acciones: Acciones }) {
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function quitar(m: ModeloDis) {
    setOcupado(m.id);
    try {
      const r = await pedir<{ modelos: ModeloDis[]; archivado: boolean }>(`/api/dispositivos/modelos/${m.id}`, 'DELETE');
      acciones.setModelos(r.modelos);
      toast.success(r.archivado ? `${m.etiqueta}: archivado (hay iPads que lo usan)` : `${m.etiqueta}: quitado`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido quitar');
    } finally {
      setOcupado(null);
    }
  }

  async function reactivar(m: ModeloDis) {
    setOcupado(m.id);
    try {
      const r = await pedir<{ modelos: ModeloDis[] }>(`/api/dispositivos/modelos/${m.id}`, 'PATCH', {
        nombre: m.nombre,
        capacidadGb: m.capacidadGb,
        notas: m.notas,
        activo: true,
      });
      acciones.setModelos(r.modelos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Los modelos que se ofrecen al dar de alta un iPad del cole o al apuntar el de un alumno. Nombre y capacidad, y listo.
        </p>
        {editando !== 'nuevo' && (
          <button type="button" className={buttonVariants()} onClick={() => setEditando('nuevo')}>
            <Plus className="h-4 w-4" /> Modelo nuevo
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {editando === 'nuevo' && <FormModelo acciones={acciones} onCerrar={() => setEditando(null)} />}
        {modelos.length === 0 && editando !== 'nuevo' && <p className="px-4 py-8 text-center text-sm text-zinc-500">Todavía no hay modelos.</p>}
        {modelos.map((m) =>
          editando === m.id ? (
            <FormModelo key={m.id} modelo={m} acciones={acciones} onCerrar={() => setEditando(null)} />
          ) : (
            <div
              key={m.id}
              className={cn('flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800', !m.activo && 'opacity-60')}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                  {m.etiqueta}
                  {!m.activo && <span className="ml-2 text-xs font-normal text-zinc-500">archivado</span>}
                </span>
                <span className="block text-xs text-zinc-500">
                  {m.enUso ? `${m.enUso} iPads lo usan` : 'Nadie lo usa todavía'}
                  {m.notas ? ` · ${m.notas}` : ''}
                </span>
              </span>
              {ocupado === m.id && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
              <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => setEditando(m.id)} aria-label={`Editar ${m.etiqueta}`}>
                <Pencil className="h-4 w-4" />
              </button>
              {m.activo ? (
                <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => void quitar(m)} disabled={ocupado === m.id} aria-label={`Quitar ${m.etiqueta}`}>
                  <Archive className="h-4 w-4" /> <span className="hidden sm:inline">{m.enUso ? 'Archivar' : 'Quitar'}</span>
                </button>
              ) : (
                <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => void reactivar(m)} disabled={ocupado === m.id}>
                  <ArchiveRestore className="h-4 w-4" /> <span className="hidden sm:inline">Recuperar</span>
                </button>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function FormModelo({ modelo, acciones, onCerrar }: { modelo?: ModeloDis; acciones: Acciones; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(modelo?.nombre ?? 'iPad ');
  const [capacidad, setCapacidad] = useState(modelo?.capacidadGb ? String(modelo.capacidadGb) : '');
  const [notas, setNotas] = useState(modelo?.notas ?? '');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      const cuerpo = { nombre: nombre.trim(), capacidadGb: capacidad ? Number(capacidad) : null, notas: notas.trim() || null };
      const r = modelo
        ? await pedir<{ modelos: ModeloDis[] }>(`/api/dispositivos/modelos/${modelo.id}`, 'PATCH', cuerpo)
        : await pedir<{ modelos: ModeloDis[] }>('/api/dispositivos/modelos', 'POST', cuerpo);
      acciones.setModelos(r.modelos);
      haptic.success();
      onCerrar();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-4 sm:grid-cols-[minmax(0,2fr)_120px_minmax(0,2fr)_auto] sm:items-end dark:border-zinc-800 dark:bg-zinc-800/40">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Modelo</span>
        <input className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="iPad (9.ª generación)" required autoFocus />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">GB</span>
        <input
          className={claseCampo}
          inputMode="numeric"
          value={capacidad}
          onChange={(e) => setCapacidad(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="64"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notas <span className="font-normal text-zinc-500">(opcional)</span>
        </span>
        <input className={claseCampo} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Wi-Fi, gris espacial…" />
      </label>
      <div className="flex gap-2">
        <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={onCerrar}>
          Cancelar
        </button>
        <button type="submit" className={buttonVariants()} disabled={ocupado}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
      </div>
    </form>
  );
}
