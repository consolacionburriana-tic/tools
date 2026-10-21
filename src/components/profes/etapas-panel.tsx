'use client';

// Las etapas de cada profe, en multiselección: hay quien da clase en dos (Nathan, Vicent
// Tarancón…). Deciden qué alumnado ve en Alumnado y qué clases en el Banco de libros. Las
// etapas de su horario y de sus tutorías cuentan solas; aquí se marca lo que falte.

import { useState } from 'react';
import { ChevronDown, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Rotulo } from '@/components/ui/rotulo';
import { Filtro, Filtros } from '@/components/ui/filtro';
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
    <Tarjeta as="section">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Layers aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Etapas</span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            Qué alumnado ve cada profe en Alumnado y en el Banco de libros
            {sinEtapa > 0 ? ` · ${sinEtapa} sin ninguna (no ven a nadie)` : ''}
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Marca todas las etapas en las que da clase. Las que salen con borde discontinuo ya le vienen de su
            horario o de su tutoría y cuentan aunque no las marques.
          </p>
          {grupos.map((grupo) => (
            <div key={grupo.clave}>
              <Rotulo as="h3" className="mb-1.5">{grupo.label}</Rotulo>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grupo.items.map((profe) => (
                  <FilaEtapas key={profe.id} profe={profe} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">{profe.nombre}</p>
      <Filtros etiqueta={`Etapas de ${profe.nombre}`} className="gap-1.5">
        {guardando && <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-400" />}
        {ETAPAS.map((e) => {
          const marcada = etapas.includes(e.clave);
          const automatica = profe.automaticas.includes(e.clave);
          return (
            <Filtro
              key={e.clave}
              activo={marcada}
              onClick={() => void alternar(e.clave)}
              // Discontinua: ya le viene de su horario o su tutoría (lo explica el texto de arriba).
              className={automatica && !marcada ? 'border-dashed border-zinc-400 dark:border-zinc-500' : undefined}
            >
              {e.label}
              {automatica && !marcada && <span className="sr-only"> (ya le viene de su horario o su tutoría)</span>}
            </Filtro>
          );
        })}
      </Filtros>
    </li>
  );
}
