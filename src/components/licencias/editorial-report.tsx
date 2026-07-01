'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Loader2, Send } from 'lucide-react';
import { euros } from '@/lib/licencias';

interface Row {
  cod: string;
  editorial: string;
  isbn: string;
  curso: string;
  asignatura: string;
  nombreLibro: string;
  bancoLibros: boolean;
  precio: string;
  unidades: number;
}

export function EditorialReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pedidosCount, setPedidosCount] = useState(0);
  const [pendingTemplateCount, setPendingTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/licencias/admin/editorial-report');
      const data = await res.json();
      setRows(data.rows ?? []);
      setPedidosCount(data.pedidosCount ?? 0);
      setPendingTemplateCount(data.pendingTemplateCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function procesar() {
    if (!confirm(`Se generará el CSV y se marcarán ${pedidosCount} pedido(s) como "pedidos a la editorial" (🧾). No podrás deshacerlo desde aquí. ¿Continuar?`)) return;
    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch('/api/licencias/admin/editorial-report/process', { method: 'POST' });
      if (!res.ok) {
        setMsg(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Informe-editoriales.csv';
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Marcados ${pedidosCount} pedido(s) como pedidos a la editorial.`);
      await load();
    } finally {
      setProcessing(false);
    }
  }

  async function marcarEnviados() {
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/licencias/admin/editorial-report/send-template', { method: 'POST' });
      const data = await res.json();
      setMsg(`Marcados ${data.count ?? 0} pedido(s) como pasados a plantillas de envío.`);
      await load();
    } finally {
      setSending(false);
    }
  }

  const totalUds = rows.reduce((s, r) => s + r.unidades, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Licencias de pedidos <strong>aún no pedidos a la editorial</strong> (🧾), agrupadas por editorial/libro —
          equivalente al informe que antes se generaba en el Google Sheet.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={procesar}
            disabled={processing || rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar informe y marcar {pedidosCount > 0 ? `(${pedidosCount} pedidos)` : ''}
          </button>
          <button
            type="button"
            onClick={marcarEnviados}
            disabled={sending || pendingTemplateCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Marcar pasados a plantillas {pendingTemplateCount > 0 ? `(${pendingTemplateCount})` : ''}
          </button>
        </div>
        {msg && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {msg}
          </p>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay pedidos pendientes de procesar. ✅</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Editorial</th>
                <th className="px-3 py-2 text-left font-medium">Libro</th>
                <th className="px-3 py-2 text-left font-medium">Curso</th>
                <th className="px-3 py-2 text-right font-medium">Uds</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.cod} className="bg-white dark:bg-zinc-900">
                  <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-100">{r.editorial || '—'}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                    {r.asignatura} <span className="text-xs text-zinc-400">{r.nombreLibro}</span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">{r.curso}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-zinc-800 dark:text-zinc-100">{r.unidades}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-500">{euros(parseFloat(r.precio || '0'))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-zinc-500">Total unidades</td>
                <td className="px-3 py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">{totalUds}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
