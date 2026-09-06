'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Check, ChevronDown, ChevronUp, Copy, Loader2, PiggyBank, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { CURSOS_FORM, cursoLabel, euros, normalize } from '@/lib/licencias';
import { ordenCurso } from '@/lib/cursos';

interface OrderRow {
  id: string;
  studentId: string;
  nombre: string;
  apellidos: string;
  curso: string;
  letra: string | null;
  bancoLibros: boolean;
  email: string | null;
  nia: string | null;
  total: string;
  itemCount: number;
  confirmedAt: string | null;
  editorialProcessedAt: string | null;
  sentToTemplateAt: string | null;
  paidAt: string | null;
  archived: boolean;
  archivedReason: string | null;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

type Campo = 'alumno' | 'curso' | 'letra' | 'fecha' | 'total';
type Orden = { campo: Campo; asc: boolean };

/** Comparador por columna. El orden de cursos es el escolar (infantil → ESO), no el alfabético. */
function comparar(a: OrderRow, b: OrderRow, campo: Campo): number {
  switch (campo) {
    case 'alumno':
      return `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es', { sensitivity: 'base' });
    case 'curso':
      return ordenCurso(a.curso) - ordenCurso(b.curso) || (a.letra ?? '').localeCompare(b.letra ?? '', 'es');
    case 'letra':
      return (a.letra ?? '').localeCompare(b.letra ?? '', 'es') || ordenCurso(a.curso) - ordenCurso(b.curso);
    case 'fecha':
      return (a.confirmedAt ? Date.parse(a.confirmedAt) : 0) - (b.confirmedAt ? Date.parse(b.confirmedAt) : 0);
    case 'total':
      return parseFloat(a.total) - parseFloat(b.total);
  }
}

function Badge({ on, label, title }: { on: boolean; label: string; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600'
      }`}
    >
      {label}
    </span>
  );
}

export function PedidosList() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [curso, setCurso] = useState('todos');
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Por defecto, lo último pedido arriba (es como venía ordenado del servidor).
  const [orden, setOrden] = useState<Orden>({ campo: 'fecha', asc: false });

  /** Un clic ordena por esa columna; otro clic le da la vuelta. */
  function ordenarPor(campo: Campo) {
    setOrden((prev) => ({ campo, asc: prev.campo === campo ? !prev.asc : campo !== 'fecha' }));
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/licencias/admin/orders${includeArchived ? '?archived=1' : ''}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const lista = orders.filter((o) => {
      if (curso !== 'todos' && o.curso !== curso) return false;
      if (nq && !normalize(`${o.apellidos} ${o.nombre}`).includes(nq)) return false;
      return true;
    });
    return lista.sort((a, b) => (orden.asc ? 1 : -1) * comparar(a, b, orden.campo));
  }, [orders, curso, q, orden]);

  async function togglePagado(o: OrderRow) {
    setBusyId(o.id);
    try {
      await fetch(`/api/licencias/admin/orders/${o.id}/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !o.paidAt }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleArchivado(o: OrderRow) {
    if (!o.archived && !confirm(`¿Archivar el pedido de ${o.nombre} ${o.apellidos}? Se guarda como backup y deja de contar en las estadísticas.`)) return;
    setBusyId(o.id);
    try {
      await fetch(`/api/licencias/admin/orders/${o.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !o.archived }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function copiarNia(nia: string) {
    void navigator.clipboard.writeText(nia);
    haptic.success();
    toast.success('NIA copiado');
  }

  async function eliminar(o: OrderRow) {
    if (!confirm(`Esto BORRA definitivamente el pedido de ${o.nombre} ${o.apellidos} (no queda backup). ¿Seguro? Si dudas, usa "Archivar" en su lugar.`)) return;
    setBusyId(o.id);
    try {
      await fetch(`/api/licencias/admin/orders/${o.id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={curso}
          onChange={(e) => setCurso(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
        >
          <option value="todos">Todos los cursos</option>
          {CURSOS_FORM.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar apellidos…"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="accent-blue-600" />
          Incluir archivados
        </label>
      </div>

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                {(
                  [
                    { campo: 'alumno', label: 'Alumno', align: 'text-left' },
                    { campo: 'curso', label: 'Curso', align: 'text-left' },
                    { campo: 'letra', label: 'Clase', align: 'text-left' },
                    { campo: 'fecha', label: 'Fecha', align: 'text-left' },
                    { campo: 'total', label: 'Total', align: 'text-right' },
                  ] as const
                ).map((c) => (
                  <th key={c.campo} className={`px-3 py-2 font-medium ${c.align}`}>
                    <button
                      type="button"
                      onClick={() => ordenarPor(c.campo)}
                      title={`Ordenar por ${c.label.toLowerCase()}`}
                      className={`inline-flex cursor-pointer items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200 ${
                        orden.campo === c.campo ? 'text-zinc-800 dark:text-zinc-100' : ''
                      }`}
                    >
                      {c.label}
                      {orden.campo === c.campo &&
                        (orden.asc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium">NIA</th>
                <th className="px-3 py-2 text-center font-medium">🧾</th>
                <th className="px-3 py-2 text-center font-medium">📤</th>
                <th className="px-3 py-2 text-center font-medium">💰</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((o) => (
                <tr key={o.id} className={o.archived ? 'bg-zinc-50/60 text-zinc-400 dark:bg-zinc-800/20' : 'bg-white dark:bg-zinc-900'}>
                  <td className="px-3 py-2.5">
                    <Link href={`/gestion/licencias/pedidos/${o.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      {o.nombre} {o.apellidos}
                    </Link>
                    {o.archived && <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">(archivado)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{cursoLabel(o.curso)}</td>
                  <td className="px-3 py-2.5">
                    {o.letra ? (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                        {o.letra}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">{fmt(o.confirmedAt)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-zinc-800 dark:text-zinc-100">{euros(parseFloat(o.total))}</td>
                  <td className="px-3 py-2.5">
                    {o.nia ? (
                      <button
                        type="button"
                        title="Copiar NIA"
                        onClick={() => copiarNia(o.nia!)}
                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        {o.nia} <Copy className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center"><Badge on={!!o.editorialProcessedAt} label="🧾" title="Pedido a la editorial" /></td>
                  <td className="px-3 py-2.5 text-center"><Badge on={!!o.sentToTemplateAt} label="📤" title="Pasado a plantillas de envío" /></td>
                  <td className="px-3 py-2.5 text-center"><Badge on={!!o.paidAt} label="💰" title="Pagado" /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title={o.paidAt ? 'Desmarcar pagado' : 'Marcar pagado'}
                        onClick={() => togglePagado(o)}
                        disabled={busyId === o.id}
                        className={`rounded-lg p-1.5 cursor-pointer disabled:opacity-40 ${o.paidAt ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                      >
                        <PiggyBank className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={o.archived ? 'Desarchivar' : 'Archivar'}
                        onClick={() => toggleArchivado(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 cursor-pointer disabled:opacity-40"
                      >
                        {o.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        title="Eliminar definitivamente"
                        onClick={() => eliminar(o)}
                        disabled={busyId === o.id}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-zinc-400">Sin pedidos que coincidan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        <Check className="mr-1 inline h-3 w-3" />
        🧾 pedido a la editorial · 📤 pasado a plantillas de envío · 💰 pagado. Click en el nombre para ver/editar el
        detalle, y en cualquier cabecera (Alumno, Curso, Clase, Fecha, Total) para ordenar por ella.
      </p>
    </div>
  );
}
