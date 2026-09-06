'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import type { MissingStudent } from '@/lib/licencias-server';

export function FaltanList({ data }: { data: MissingStudent[] }) {
  const [students, setStudents] = useState(data);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [curso, setCurso] = useState<string>('');

  const visibles = showCompleted ? students : students.filter((s) => !s.manualCompletedAt);
  const cursos = useMemo(() => [...new Set(visibles.map((s) => s.curso))].sort(), [visibles]);
  const filtered = curso ? visibles.filter((s) => s.curso === curso) : visibles;
  const pendientesCount = students.filter((s) => !s.manualCompletedAt).length;

  function copiarNia(nia: string) {
    void navigator.clipboard.writeText(nia);
    haptic.success();
    toast.success('NIA copiado');
  }

  async function marcarCompletado(s: MissingStudent) {
    const completar = !s.manualCompletedAt;
    if (
      completar &&
      !confirm(
        `¿Marcar a ${s.nombre} ${s.apellidos} como completado a mano? Dejará de contar como pendiente aunque no haya hecho pedido.`,
      )
    )
      return;
    setBusyId(s.id);
    try {
      await fetch(`/api/licencias/admin/students/${s.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: completar }),
      });
      setStudents((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, manualCompletedAt: completar ? new Date().toISOString() : null } : x)),
      );
      haptic.success();
      toast.success(completar ? 'Marcado como completado' : 'Desmarcado');
    } finally {
      setBusyId(null);
    }
  }

  async function marcarTodosVisiblesCompletados() {
    const pendientes = filtered.filter((s) => !s.manualCompletedAt);
    if (pendientes.length === 0) return;
    if (
      !confirm(
        `¿Marcar estos ${pendientes.length} alumnos (${curso || 'todos los cursos visibles'}) como completados a mano? Dejarán de contar como pendientes aunque no hayan hecho pedido.`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      await Promise.all(
        pendientes.map((s) =>
          fetch(`/api/licencias/admin/students/${s.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
          }),
        ),
      );
      const ids = new Set(pendientes.map((s) => s.id));
      const now = new Date().toISOString();
      setStudents((prev) => prev.map((x) => (ids.has(x.id) ? { ...x, manualCompletedAt: now } : x)));
      haptic.success();
      toast.success(`${pendientes.length} marcados como completados`);
    } finally {
      setBulkBusy(false);
    }
  }

  function descargarCsv() {
    const head = ['Curso', 'Apellidos', 'Nombre', 'NIA', 'Correo', 'Completado a mano'];
    const rows = filtered.map((s) => [s.curso, s.apellidos, s.nombre, s.nia ?? '', s.email ?? '', s.manualCompletedAt ? 'Sí' : '']);
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
          Todos ({pendientesCount})
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
            {c} ({visibles.filter((s) => s.curso === c).length})
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="accent-blue-600" />
          Ver completados a mano
        </label>
        <button
          type="button"
          onClick={marcarTodosVisiblesCompletados}
          disabled={bulkBusy || filtered.every((s) => !!s.manualCompletedAt)}
          title="Marca como completados a mano todos los alumnos visibles con el filtro actual"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <CheckCircle2 className="h-4 w-4" /> Marcar visibles como completados
        </button>
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
              <th className="px-4 py-2 text-left font-medium">NIA</th>
              <th className="px-4 py-2 text-left font-medium">Correo</th>
              <th className="px-4 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-zinc-400">
                  ¡Nadie falta aquí! 🎉
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className={s.manualCompletedAt ? 'bg-zinc-50/60 text-zinc-400 dark:bg-zinc-800/20' : 'bg-white dark:bg-zinc-900'}>
                <td className="px-4 py-2 text-zinc-500">{s.curso}</td>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {s.apellidos}
                  {s.manualCompletedAt && <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">(completado a mano)</span>}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">{s.nombre}</td>
                <td className="px-4 py-2">
                  {s.nia ? (
                    <button
                      type="button"
                      title="Copiar NIA"
                      onClick={() => copiarNia(s.nia!)}
                      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      {s.nia} <Copy className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-500">{s.email ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    title={s.manualCompletedAt ? 'Desmarcar completado' : 'Marcar como completado a mano'}
                    onClick={() => marcarCompletado(s)}
                    disabled={busyId === s.id}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium cursor-pointer disabled:opacity-40 ${
                      s.manualCompletedAt
                        ? 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                    }`}
                  >
                    {s.manualCompletedAt ? (
                      <>
                        <Undo2 className="h-3.5 w-3.5" /> Desmarcar
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completado
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
