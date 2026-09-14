'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Copy, Download, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { compararClases, ordenCurso } from '@/lib/cursos';
import type { MissingStudent } from '@/lib/licencias-server';

/** Motivo que se guarda al marcar a mano desde esta pantalla. */
const MOTIVO_NO_PEDIDO = 'No va a hacer pedido';

type Columna = 'curso' | 'clase' | 'apellidos' | 'nombre' | 'nia' | 'email' | 'estado';

const cmpTexto = (a: string | null, b: string | null) =>
  (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' });

/** Comparador de cada columna en sentido ascendente; el descendente se invierte fuera. */
const COMPARADORES: Record<Columna, (a: MissingStudent, b: MissingStudent) => number> = {
  curso: (a, b) => compararClases(a, b),
  clase: (a, b) => cmpTexto(a.letra, b.letra) || compararClases(a, b),
  apellidos: (a, b) => cmpTexto(a.apellidos, b.apellidos) || cmpTexto(a.nombre, b.nombre),
  nombre: (a, b) => cmpTexto(a.nombre, b.nombre) || cmpTexto(a.apellidos, b.apellidos),
  nia: (a, b) => cmpTexto(a.nia, b.nia),
  email: (a, b) => cmpTexto(a.email, b.email),
  estado: (a, b) => Number(!!a.manualCompletedAt) - Number(!!b.manualCompletedAt),
};

/** Cabecera de columna: clic para ordenar, segundo clic para invertir. */
function Cabecera({
  col,
  orden,
  onSort,
  children,
  align = 'left',
}: {
  col: Columna;
  orden: { col: Columna; desc: boolean };
  onSort: (col: Columna) => void;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const activa = orden.col === col;
  const Icono = activa ? (orden.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className={`px-4 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title="Ordenar por esta columna"
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 ${
          activa ? 'text-zinc-700 dark:text-zinc-200' : ''
        }`}
      >
        {children}
        <Icono className={`h-3 w-3 ${activa ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export function FaltanList({ data }: { data: MissingStudent[] }) {
  const [students, setStudents] = useState(data);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [curso, setCurso] = useState<string>('');
  const [letra, setLetra] = useState<string>('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [orden, setOrden] = useState<{ col: Columna; desc: boolean }>({ col: 'curso', desc: false });

  const visibles = showCompleted ? students : students.filter((s) => !s.manualCompletedAt);
  // Cursos y letras ordenados de verdad (etapa → nivel → letra), no por texto: si no,
  // "1ESO" se cuela entre "1PRI" y "2PRI" y la B aparece antes que la A según el alumno.
  const cursos = useMemo(
    () => [...new Set(visibles.map((s) => s.curso))].sort((a, b) => ordenCurso(a) - ordenCurso(b) || cmpTexto(a, b)),
    [visibles],
  );
  const letras = useMemo(
    () =>
      [...new Set(visibles.filter((s) => (curso ? s.curso === curso : true) && s.letra).map((s) => s.letra!))].sort(
        (a, b) => cmpTexto(a, b),
      ),
    [visibles, curso],
  );

  const filtered = useMemo(() => {
    const base = visibles.filter((s) => (curso ? s.curso === curso : true) && (letra ? s.letra === letra : true));
    const cmp = COMPARADORES[orden.col];
    return [...base].sort((a, b) => {
      const d = cmp(a, b);
      const principal = orden.desc ? -d : d;
      // Desempate estable y legible: siempre clase y apellidos.
      return principal || compararClases(a, b) || cmpTexto(a.apellidos, b.apellidos);
    });
  }, [visibles, curso, letra, orden]);

  const pendientesCount = students.filter((s) => !s.manualCompletedAt).length;
  const seleccionados = filtered.filter((s) => sel.has(s.id));
  const todosSeleccionados = filtered.length > 0 && seleccionados.length === filtered.length;

  function ordenarPor(col: Columna) {
    setOrden((o) => ({ col, desc: o.col === col ? !o.desc : false }));
  }

  function alternar(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    haptic.tap();
  }

  function alternarTodos() {
    setSel((prev) => {
      const next = new Set(prev);
      if (todosSeleccionados) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
    haptic.tap();
  }

  function aplicarEnEstado(ids: Set<string>, completar: boolean) {
    const now = new Date().toISOString();
    setStudents((prev) =>
      prev.map((x) =>
        ids.has(x.id)
          ? {
              ...x,
              manualCompletedAt: completar ? now : null,
              manualCompletedReason: completar ? MOTIVO_NO_PEDIDO : null,
            }
          : x,
      ),
    );
  }

  function copiarNia(nia: string) {
    void navigator.clipboard.writeText(nia);
    haptic.success();
    toast.success('NIA copiado');
  }

  async function marcarCompletado(s: MissingStudent) {
    const completar = !s.manualCompletedAt;
    setBusyId(s.id);
    try {
      await fetch(`/api/licencias/admin/students/${s.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: completar, reason: completar ? MOTIVO_NO_PEDIDO : undefined }),
      });
      aplicarEnEstado(new Set([s.id]), completar);
      haptic.success();
      toast.success(completar ? `${s.nombre} no hará pedido` : 'Vuelve a contar como pendiente');
    } finally {
      setBusyId(null);
    }
  }

  async function marcarSeleccionados(completar: boolean) {
    const ids = seleccionados.filter((s) => !!s.manualCompletedAt !== completar).map((s) => s.id);
    if (ids.length === 0) return;
    if (
      completar &&
      !confirm(
        `¿Marcar ${ids.length} alumno${ids.length === 1 ? '' : 's'} como que NO va${ids.length === 1 ? '' : 'n'} a hacer el pedido? Dejará${ids.length === 1 ? '' : 'n'} de contar como pendiente${ids.length === 1 ? '' : 's'}.`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/licencias/admin/students/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, completed: completar, reason: completar ? MOTIVO_NO_PEDIDO : undefined }),
      });
      if (!res.ok) {
        haptic.warning();
        toast.error('No se ha podido guardar');
        return;
      }
      aplicarEnEstado(new Set(ids), completar);
      setSel(new Set());
      haptic.success();
      toast.success(
        completar ? `${ids.length} marcados como que no harán pedido` : `${ids.length} vuelven a contar como pendientes`,
      );
    } finally {
      setBulkBusy(false);
    }
  }

  function descargarCsv() {
    const head = ['Curso', 'Clase', 'Apellidos', 'Nombre', 'NIA', 'Correo', 'No hará pedido'];
    const rows = filtered.map((s) => [
      s.curso,
      s.letra ?? '',
      s.apellidos,
      s.nombre,
      s.nia ?? '',
      s.email ?? '',
      s.manualCompletedAt ? 'Sí' : '',
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faltan-licencias${curso ? '-' + curso : ''}${letra ? letra : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = (activo: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
      activo
        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
        : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setCurso(''); setLetra(''); }} className={chip(curso === '')}>
          Todos ({pendientesCount})
        </button>
        {cursos.map((c) => (
          <button key={c} type="button" onClick={() => { setCurso(c); setLetra(''); }} className={chip(curso === c)}>
            {c} ({visibles.filter((s) => s.curso === c).length})
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-blue-600"
          />
          Ver los que no harán pedido
        </label>
        <button
          type="button"
          onClick={descargarCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          <Download className="h-4 w-4" /> CSV ({filtered.length})
        </button>
      </div>

      {letras.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Clase:</span>
          <button type="button" onClick={() => setLetra('')} className={chip(letra === '')}>
            Todas
          </button>
          {letras.map((l) => (
            <button key={l} type="button" onClick={() => setLetra(l)} className={chip(letra === l)}>
              {l} ({visibles.filter((s) => (curso ? s.curso === curso : true) && s.letra === l).length})
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-sm text-zinc-500">
          {seleccionados.length === 0
            ? 'Selecciona alumnos para marcar que no harán pedido'
            : `${seleccionados.length} seleccionado${seleccionados.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          onClick={() => marcarSeleccionados(true)}
          disabled={bulkBusy || seleccionados.every((s) => !!s.manualCompletedAt)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <CheckCircle2 className="h-4 w-4" /> No harán pedido
        </button>
        <button
          type="button"
          onClick={() => marcarSeleccionados(false)}
          disabled={bulkBusy || seleccionados.every((s) => !s.manualCompletedAt)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Undo2 className="h-4 w-4" /> Desmarcar
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los visibles"
                  title="Seleccionar todos los visibles"
                  checked={todosSeleccionados}
                  onChange={alternarTodos}
                  disabled={filtered.length === 0}
                  className="h-4 w-4 accent-blue-600 cursor-pointer"
                />
              </th>
              <Cabecera orden={orden} onSort={ordenarPor} col="curso">Curso</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="clase">Clase</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="apellidos">Apellidos</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="nombre">Nombre</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="nia">NIA</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="email">Correo</Cabecera>
              <Cabecera orden={orden} onSort={ordenarPor} col="estado" align="right">
                Acciones
              </Cabecera>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-zinc-400">
                  ¡Nadie falta aquí! 🎉
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr
                key={s.id}
                className={
                  sel.has(s.id)
                    ? 'bg-blue-50/60 dark:bg-blue-500/10'
                    : s.manualCompletedAt
                      ? 'bg-zinc-50/60 text-zinc-400 dark:bg-zinc-800/20'
                      : 'bg-white dark:bg-zinc-900'
                }
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar a ${s.nombre} ${s.apellidos}`}
                    checked={sel.has(s.id)}
                    onChange={() => alternar(s.id)}
                    className="h-4 w-4 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-2 text-zinc-500">{s.curso}</td>
                <td className="px-4 py-2">
                  {s.letra ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {s.letra}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {s.apellidos}
                  {s.manualCompletedAt && (
                    <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">(no hará pedido)</span>
                  )}
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
                    title={s.manualCompletedAt ? 'Volver a contarlo como pendiente' : 'Marcar que no hará el pedido'}
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
                        <CheckCircle2 className="h-3.5 w-3.5" /> No hará pedido
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
