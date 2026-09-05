'use client';

// Elegir QUÉ horario se mira, con los mínimos toques posibles: la vista en tres pestañas,
// el filtro de curso solo cuando aporta, y la lista de abajo siempre visible (nada de un
// desplegable que hay que abrir para ver qué hay).

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DoorOpen, Filter, MapPin, Users } from 'lucide-react';

import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { OpcionesNavegador, VistaHorario } from '@/lib/horarios-server';

const ETIQUETA_LISTA: Record<VistaHorario, string> = {
  clase: 'Clase',
  profe: 'Profesor/a',
  aula: 'Aula',
};

const VISTAS: { id: VistaHorario; label: string; icono: typeof Users }[] = [
  { id: 'clase', label: 'Clase', icono: Users },
  { id: 'profe', label: 'Profesor', icono: DoorOpen },
  { id: 'aula', label: 'Aula', icono: MapPin },
];

export function Selector({
  opciones,
  vista,
  clave,
  puedeVerProfes,
}: {
  opciones: OpcionesNavegador;
  vista: VistaHorario;
  clave: string;
  puedeVerProfes: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [curso, setCurso] = useState<string>('');
  const [busca, setBusca] = useState('');

  const vistas = puedeVerProfes ? VISTAS : VISTAS.filter((v) => v.id !== 'profe');

  const ir = (v: VistaHorario, k: string) => {
    haptic.tap();
    const p = new URLSearchParams(params.toString());
    p.set('vista', v);
    p.set('clave', k);
    router.push(`/gestion/horarios?${p.toString()}`);
  };

  // Cursos disponibles ('2PRI', '3INF'…) para el filtro rápido de la vista de clases.
  const cursos = useMemo(
    () => [...new Set(opciones.clases.map((c) => c.curso))],
    [opciones.clases],
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (vista === 'clase') {
      return opciones.clases
        .filter((c) => !curso || c.curso === curso)
        .filter((c) => !q || c.etiqueta.toLowerCase().includes(q))
        .map((c) => ({ clave: `${c.curso}|${c.letra ?? ''}`, etiqueta: c.etiqueta, pista: c.etapa }));
    }
    if (vista === 'profe') {
      return opciones.profes
        .filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.alias ?? '').toLowerCase().includes(q))
        .map((p) => ({ clave: p.id, etiqueta: p.nombre, pista: p.alias }));
    }
    return opciones.espacios
      .filter((e) => !q || e.nombre.toLowerCase().includes(q))
      .map((e) => ({ clave: e.id, etiqueta: e.nombre, pista: e.codigo }));
  }, [vista, curso, busca, opciones]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {vistas.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => ir(v.id, '')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              vista === v.id
                ? 'bg-white text-indigo-700 shadow-sm dark:bg-zinc-900 dark:text-indigo-300'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <v.icono className="h-4 w-4" />
            {v.label}
          </button>
        ))}
      </div>

      {/* Estas dos filas hacen cosas distintas y antes se confundían (parecían dos listas de
          clases). Van etiquetadas: arriba se ACOTA el curso, abajo se ELIGE la clase. */}
      {vista === 'clase' && cursos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 pr-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            <Filter className="h-3.5 w-3.5" /> Curso
          </span>
          <Filtro activo={!curso} onClick={() => setCurso('')}>Todos</Filtro>
          {cursos.map((c) => (
            <Filtro key={c} activo={curso === c} onClick={() => setCurso(c)}>{c}</Filtro>
          ))}
        </div>
      )}

      {lista.length > 12 && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={vista === 'profe' ? 'Buscar profesor/a…' : 'Buscar…'}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-indigo-500/20"
        />
      )}

      {/* En móvil una tira que se desliza (18 clases en rejilla se comen media pantalla);
          en pantalla grande, todas a la vista de un vistazo. */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-zinc-400 dark:text-zinc-500">{ETIQUETA_LISTA[vista]}</span>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {lista.map((o) => (
          <button
            key={o.clave}
            type="button"
            onClick={() => ir(vista, o.clave)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors',
              clave === o.clave
                ? 'border-indigo-500 bg-indigo-500 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-indigo-500/10',
            )}
          >
            {o.etiqueta}
            {o.pista && clave !== o.clave && <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">{o.pista}</span>}
          </button>
        ))}
          {lista.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nada que mostrar.</p>}
        </div>
      </div>
    </div>
  );
}

function Filtro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => { haptic.tap(); onClick(); }}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        activo ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400',
      )}
    >
      {children}
    </button>
  );
}
