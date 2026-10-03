'use client';

// Buscar gente del claustro para meterla en un equipo. Solo salen personas de dentro (profes
// activos y cuentas de Usuarios y roles): nada de escribir correos de fuera.
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/tableros';
import { api, Avatar, ESTILO_CAMPO } from './comun';

// Una sola descarga por visita: la lista del claustro no cambia mientras se usa la pantalla.
let cache: Promise<Persona[]> | null = null;
function cargarPersonas(): Promise<Persona[]> {
  if (!cache) cache = api.personas().catch((e) => ((cache = null), Promise.reject(e)));
  return cache;
}

function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function SelectorPersonas({
  seleccionados,
  onChange,
  excluir = [],
  autoFocus = false,
}: {
  seleccionados: Persona[];
  onChange: (p: Persona[]) => void;
  /** Correos que ya están (no se ofrecen). */
  excluir?: string[];
  autoFocus?: boolean;
}) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    cargarPersonas()
      .then(setPersonas)
      .catch(() => setError(true));
  }, []);

  const fuera = useMemo(() => new Set([...excluir, ...seleccionados.map((s) => s.email)]), [excluir, seleccionados]);
  const resultados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!personas || !t) return [];
    return personas.filter((p) => !fuera.has(p.email) && normalizar(`${p.nombre} ${p.email}`).includes(t)).slice(0, 8);
  }, [personas, q, fuera]);

  return (
    <div className="space-y-2">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((p) => (
            <span
              key={p.email}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-0.5 pr-1 pl-0.5 text-sm dark:bg-zinc-800"
            >
              <Avatar email={p.email} nombre={p.nombre} className="h-6 w-6 text-[10px] ring-0" />
              {p.nombre}
              <button
                type="button"
                onClick={() => onChange(seleccionados.filter((s) => s.email !== p.email))}
                aria-label={`Quitar a ${p.nombre}`}
                className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder={personas ? 'Busca por nombre o correo…' : error ? 'No se ha podido cargar el claustro' : 'Cargando el claustro…'}
          disabled={!personas}
          className={cn(ESTILO_CAMPO, 'pl-9')}
        />
      </div>
      {resultados.length > 0 && (
        <ul className="max-h-60 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {resultados.map((p) => (
            <li key={p.email}>
              <button
                type="button"
                onClick={() => {
                  onChange([...seleccionados, p]);
                  setQ('');
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Avatar email={p.email} nombre={p.nombre} className="ring-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.nombre}</span>
                  <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {personas && q.trim() && resultados.length === 0 && <p className="px-1 text-xs text-zinc-500">Nadie del claustro con ese nombre.</p>}
    </div>
  );
}
