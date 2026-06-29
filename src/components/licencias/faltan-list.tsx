'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { MissingStudent } from '@/lib/licencias-server';

export function FaltanList({ data }: { data: MissingStudent[] }) {
  const cursos = useMemo(() => [...new Set(data.map((s) => s.curso))].sort(), [data]);
  const [curso, setCurso] = useState<string>('');

  const filtered = curso ? data.filter((s) => s.curso === curso) : data;

  function descargarCsv() {
    const head = ['Curso', 'Apellidos', 'Nombre', 'Correo'];
    const rows = filtered.map((s) => [s.curso, s.apellidos, s.nombre, s.email ?? '']);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faltan-licencias${curso ? '-' + curso : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCurso('')}
          className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
            curso === '' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
          }`}
        >
          Todos ({data.length})
        </button>
        {cursos.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurso(c)}
            className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
              curso === c ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            {c} ({data.filter((s) => s.curso === c).length})
          </button>
        ))}
        <button
          type="button"
          onClick={descargarCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          <Download className="h-4 w-4" /> CSV ({filtered.length})
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Curso</th>
              <th className="px-4 py-2 text-left font-medium">Apellidos</th>
              <th className="px-4 py-2 text-left font-medium">Nombre</th>
              <th className="px-4 py-2 text-left font-medium">Correo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-zinc-400">
                  ¡Nadie falta aquí! 🎉
                </td>
              </tr>
            )}
            {filtered.map((s, i) => (
              <tr key={i} className="bg-white dark:bg-zinc-900">
                <td className="px-4 py-2 text-zinc-500">{s.curso}</td>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">{s.apellidos}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">{s.nombre}</td>
                <td className="px-4 py-2 text-zinc-500">{s.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
