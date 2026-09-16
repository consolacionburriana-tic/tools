'use client';

import { useState } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';

interface Clase {
  curso: string;
  letra: string;
  alumnos: number;
  lengua: string | null;
  mezclada: boolean;
}

const OPCIONES = [
  { valor: 'CAS' as const, etiqueta: 'Castellano' },
  { valor: 'VAL' as const, etiqueta: 'Valencià' },
];

export function LenguasClase({ inicial }: { inicial: Clase[] }) {
  const [clases, setClases] = useState<Clase[]>(inicial);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(c: Clase, lengua: 'CAS' | 'VAL') {
    const k = `${c.curso}|${c.letra}`;
    setGuardando(k);
    setError(null);
    const previo = clases;
    setClases((cs) =>
      cs.map((x) => (x.curso === c.curso && x.letra === c.letra ? { ...x, lengua, mezclada: false } : x)),
    );
    try {
      const res = await fetch('/api/licencias/admin/lenguas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: c.curso, letra: c.letra, lengua }),
      });
      if (!res.ok) {
        setClases(previo);
        setError((await res.json())?.error ?? 'No se ha podido guardar');
      }
    } catch {
      setClases(previo);
      setError('No se ha podido guardar');
    } finally {
      setGuardando(null);
    }
  }

  const sinPoner = clases.filter((c) => !c.lengua && !c.mezclada).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          En qué idioma va cada clase. Es lo que decide, en los libros que tienen las dos versiones, cuál le toca a
          cada alumno: en el formulario de las familias y en los informes para las editoriales.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Se guarda en la ficha de cada alumno de la clase. La sincronización de alumnado ya no lo pisa, así que se
          pone una vez al empezar el curso; si un alumno cambia de clase, vuelve a tocar su clase nueva.
        </p>
      </div>

      {sinPoner > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {sinPoner === 1 ? 'Queda 1 clase sin idioma.' : `Quedan ${sinPoner} clases sin idioma.`} Mientras esté sin
          poner, esos libros salen en castellano.
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <TriangleAlert className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Clase</th>
              <th className="px-4 py-2 text-right font-medium">Alumnos</th>
              <th className="px-4 py-2 text-right font-medium">Idioma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {clases.map((c) => {
              const k = `${c.curso}|${c.letra}`;
              return (
                <tr key={k} className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {c.curso} {c.letra || '—'}
                    {c.mezclada && (
                      <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        mezclada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-500">{c.alumnos}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {guardando === k && <Loader2 className="mr-1 h-4 w-4 animate-spin self-center text-zinc-400" />}
                      {OPCIONES.map((o) => {
                        const on = c.lengua === o.valor;
                        return (
                          <button
                            key={o.valor}
                            type="button"
                            onClick={() => elegir(c, o.valor)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                              on
                                ? 'bg-blue-600 text-white'
                                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                            {o.etiqueta}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
