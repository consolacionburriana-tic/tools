'use client';

// Pestaña «Clases de Classroom» de /gestion/calendarios: todas las clases del dominio con su
// curso y su antigüedad, para localizar las de hace años. Ficha: docs/25-calendarios.md
//
// De momento SOLO consulta: cada clase lleva su enlace para abrirla en Classroom. El borrado
// desde aquí está pendiente (ver la ficha).
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ANIOS_POR_DEFECTO, ESTADO_CLASE_LABELS, cursoLimite, type ClaseFila } from '@/lib/calendarios';

type FiltroEstado = 'todas' | 'ARCHIVED' | 'ACTIVE' | 'otras';
const FILTROS_ESTADO: [FiltroEstado, string][] = [
  ['todas', 'Cualquier estado'],
  ['ARCHIVED', 'Archivadas'],
  ['ACTIVE', 'Activas'],
  ['otras', 'Sin aceptar / otras'],
];

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function PanelClases({ iniciales }: { iniciales: ClaseFila[] }) {
  const [clases, setClases] = useState(iniciales);
  const [anios, setAnios] = useState(ANIOS_POR_DEFECTO);
  const [soloViejas, setSoloViejas] = useState(true);
  const [estado, setEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');

  // Al entrar en la pestaña, lo último (puede venir de un escaneo recién hecho).
  useEffect(() => {
    fetch('/api/calendarios/admin/clases')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { clases?: ClaseFila[] } | null) => j?.clases && setClases(j.clases))
      .catch(() => null);
  }, []);

  const vivas = clases.filter((c) => !c.borradoAt && c.estado !== 'DESAPARECIDA');
  const viejas = vivas.filter((c) => c.antiguedad !== null && c.antiguedad >= anios);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (soloViejas ? viejas : vivas)
      .filter((c) => {
        if (estado === 'todas') return true;
        if (estado === 'otras') return c.estado !== 'ACTIVE' && c.estado !== 'ARCHIVED';
        return c.estado === estado;
      })
      .filter((c) => !q || `${c.nombre ?? ''} ${c.seccion ?? ''} ${c.ownerEmail ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.curso ?? '').localeCompare(b.curso ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [vivas, viejas, soloViejas, estado, busqueda]);

  const porCurso = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of viejas) m.set(c.curso ?? '?', (m.get(c.curso ?? '?') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [viejas]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={soloViejas} onChange={(e) => setSoloViejas(e.target.checked)} />
            Solo las de
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={anios}
            onChange={(e) => setAnios(Math.max(1, Math.min(20, Number(e.target.value) || ANIOS_POR_DEFECTO)))}
            className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span>
            años o más <span className="text-xs text-zinc-500">(del {cursoLimite(anios)} hacia atrás)</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {vivas.length === 0
            ? 'Todavía no hay clases: escanea el dominio en la pestaña de calendarios.'
            : `${viejas.length} de ${vivas.length} clases tienen ${anios} años o más`}
          {porCurso.length > 0 && ` · ${porCurso.map(([c, n]) => `${c}: ${n}`).join(' · ')}`}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {FILTROS_ESTADO.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, sección o profe"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">No hay clases con estos filtros.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="truncate">{c.nombre ?? '(sin nombre)'}</span>
                    {c.seccion && <span className="text-xs font-normal text-zinc-500">{c.seccion}</span>}
                    {c.curso && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.curso}
                      </span>
                    )}
                    {c.estado && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          c.estado === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                        )}
                      >
                        {ESTADO_CLASE_LABELS[c.estado] ?? c.estado}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {c.ownerEmail ?? 'Propietario desconocido'} · creada el {fecha(c.creadaAt)} · último cambio{' '}
                    {fecha(c.actualizadaAt)}
                    {c.calendarioVivo && ' · su calendario sigue vivo'}
                  </p>
                </div>
                {c.enlace && (
                  <a
                    href={c.enlace}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Classroom
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
