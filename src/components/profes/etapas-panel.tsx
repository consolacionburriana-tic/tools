'use client';

// Las etapas de cada profe, en multiselección: hay quien da clase en dos (Nathan, Vicent
// Tarancón…). Deciden qué alumnado ve en Alumnado y qué clases en el Banco de libros. Las
// etapas de su horario y de sus tutorías cuentan solas; aquí se marca lo que falte.

import { useState } from 'react';
import { ChevronDown, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { agruparProfes, type ProfeItem } from '@/lib/profes';
import { ETAPA_LABEL, ETAPAS_VISIBLES, type Etapa } from '@/lib/cursos';

export interface ProfeEtapasUI extends ProfeItem {
  /** Las marcadas a mano (o la etapa única de antes, si nunca se han tocado). */
  etapas: Etapa[];
  /** Las que ya le vienen de su horario o sus tutorías, aunque no se marquen. */
  automaticas: Etapa[];
}

// Solo las etapas que se ofrecen (`ETAPAS_VISIBLES`); la Secundaria se llama «ESO» aquí.
const ETAPAS: { clave: Etapa; label: string }[] = ETAPAS_VISIBLES.map((clave) => ({
  clave,
  label: clave === 'ESO' ? 'ESO' : ETAPA_LABEL[clave],
}));

export function EtapasPanel({ profes }: { profes: ProfeEtapasUI[] }) {
  const [abierto, setAbierto] = useState(false);
  const grupos = agruparProfes(profes);
  const sinEtapa = profes.filter((p) => p.etapas.length === 0 && p.automaticas.length === 0).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Layers className="h-4 w-4 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Etapas</span>
          <span className="block text-xs text-zinc-500">
            Qué alumnado ve cada profe en Alumnado y en el Banco de libros
            {sinEtapa > 0 ? ` · ${sinEtapa} sin ninguna (no ven a nadie)` : ''}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Marca todas las etapas en las que da clase. Las que salen con borde discontinuo ya le vienen de su
            horario o de su tutoría y cuentan aunque no las marques.
          </p>
          {grupos.map((grupo) => (
            <div key={grupo.clave}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">{grupo.label}</h3>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grupo.items.map((profe) => (
                  <FilaEtapas key={profe.id} profe={profe} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilaEtapas({ profe }: { profe: ProfeEtapasUI }) {
  const [etapas, setEtapas] = useState<Etapa[]>(profe.etapas);
  const [guardando, setGuardando] = useState(false);

  async function alternar(etapa: Etapa) {
    const antes = etapas;
    const nuevas = ETAPAS.map((e) => e.clave).filter((e) => (e === etapa ? !antes.includes(e) : antes.includes(e)));
    setEtapas(nuevas);
    setGuardando(true);
    try {
      const res = await fetch('/api/profes/admin/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: profe.id, etapas: nuevas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      haptic.success();
    } catch (e) {
      setEtapas(antes);
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">{profe.nombre}</p>
      <div className="flex items-center gap-1.5">
        {guardando && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
        {ETAPAS.map((e) => {
          const marcada = etapas.includes(e.clave);
          const automatica = profe.automaticas.includes(e.clave);
          return (
            <button
              key={e.clave}
              type="button"
              aria-pressed={marcada}
              onClick={() => void alternar(e.clave)}
              title={automatica && !marcada ? 'Ya le viene de su horario o su tutoría' : undefined}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                marcada
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : automatica
                    ? 'border border-dashed border-zinc-400 text-zinc-600 dark:text-zinc-300'
                    : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}
