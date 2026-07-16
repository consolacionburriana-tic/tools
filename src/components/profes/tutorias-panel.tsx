'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import type { ProfeItem } from '@/lib/profes';

export interface ClaseConTutoresProp {
  curso: string;
  letra: string | null;
  numAlumnos: number;
  tutores: { id: string; teacherId: string; nombre: string }[];
}

const ETAPA_LABEL: Record<'EI' | 'EP' | 'ESO', string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };
const ETAPA_ORDEN: ('EI' | 'EP' | 'ESO')[] = ['EI', 'EP', 'ESO'];

function claseLabel(curso: string, letra: string | null) {
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}

export function TutoriasPanel({ clases: inicial, profes }: { clases: ClaseConTutoresProp[]; profes: ProfeItem[] }) {
  const [clases, setClases] = useState(inicial);
  const [abriendo, setAbriendo] = useState<string | null>(null); // curso|letra de la clase con el buscador abierto
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const porEtapa = useMemo(() => {
    const grupos: Record<string, ClaseConTutoresProp[]> = { EI: [], EP: [], ESO: [], General: [] };
    for (const c of clases) grupos[etapaDeCurso(c.curso) ?? 'General'].push(c);
    return grupos;
  }, [clases]);

  function claseKey(c: { curso: string; letra: string | null }) {
    return `${c.curso}|${c.letra ?? ''}`;
  }

  async function añadir(clase: ClaseConTutoresProp, profe: ProfeItem) {
    const key = claseKey(clase);
    setOcupado(key);
    try {
      const res = await fetch('/api/profes/admin/tutorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase.curso, letra: clase.letra, teacherId: profe.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo asignar');
      setClases((prev) =>
        prev.map((c) =>
          claseKey(c) === key ? { ...c, tutores: [...c.tutores, { id: data.id, teacherId: profe.id, nombre: profe.nombre }] } : c,
        ),
      );
      haptic.success();
      setAbriendo(null);
      setBusqueda('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(clase: ClaseConTutoresProp, tutoriaId: string) {
    const key = claseKey(clase);
    setOcupado(key);
    const previo = clases;
    setClases((prev) => prev.map((c) => (claseKey(c) === key ? { ...c, tutores: c.tutores.filter((t) => t.id !== tutoriaId) } : c)));
    try {
      const res = await fetch('/api/profes/admin/tutorias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tutoriaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo quitar');
      haptic.tap();
    } catch (e) {
      setClases(previo);
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {ETAPA_ORDEN.filter((et) => porEtapa[et]?.length).map((et) => (
        <section key={et}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{ETAPA_LABEL[et]}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {porEtapa[et].map((c) => {
              const key = claseKey(c);
              const etapaClase = etapaDeCurso(c.curso);
              const yaAsignados = new Set(c.tutores.map((t) => t.teacherId));
              const candidatos = profes
                .filter((p) => !yaAsignados.has(p.id))
                .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                .sort((a, b) => Number(b.etapa === etapaClase) - Number(a.etapa === etapaClase) || a.nombre.localeCompare(b.nombre, 'es'));

              return (
                <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{claseLabel(c.curso, c.letra)}</p>
                    <p className="text-xs text-zinc-400">{c.numAlumnos} alumnos</p>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {c.tutores.length === 0 && <span className="text-xs text-zinc-400">Sin tutor asignado</span>}
                    {c.tutores.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-1 pl-2.5 pr-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        {t.nombre}
                        <button
                          type="button"
                          disabled={ocupado === key}
                          onClick={() => void quitar(c, t.id)}
                          className="rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {ocupado === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  </div>

                  {abriendo === key ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        <Search className="h-3.5 w-3.5 text-zinc-400" />
                        <input
                          autoFocus
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar profe…"
                          className="w-full bg-transparent text-xs text-zinc-900 outline-none dark:text-zinc-100"
                        />
                        <button type="button" onClick={() => { setAbriendo(null); setBusqueda(''); }} className="text-zinc-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                        {candidatos.slice(0, 30).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => void añadir(c, p)}
                            className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            {p.nombre}
                          </button>
                        ))}
                        {candidatos.length === 0 && <span className="text-xs text-zinc-400">Sin resultados</span>}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAbriendo(key); setBusqueda(''); }}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir tutor
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
