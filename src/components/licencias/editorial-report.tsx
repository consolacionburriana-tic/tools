'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookMarked, Check, Download, Gift, Loader2, Send, TriangleAlert } from 'lucide-react';
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

function TablaLibros({ rows, gratis }: { rows: Row[]; gratis?: boolean }) {
  const totalUds = rows.reduce((s, r) => s + r.unidades, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Editorial</th>
            <th className="px-3 py-2 text-left font-medium">Libro</th>
            <th className="px-3 py-2 text-left font-medium">Curso</th>
            <th className="px-3 py-2 text-right font-medium">Uds</th>
            <th className="px-3 py-2 text-right font-medium">{gratis ? 'Precio ud.' : 'Precio'}</th>
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
            <td colSpan={3} className="px-3 py-2 text-right text-xs text-zinc-500">
              Total unidades
            </td>
            <td className="px-3 py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">{totalUds}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function EditorialReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [bancoRows, setBancoRows] = useState<Row[]>([]);
  const [bancoReportAt, setBancoReportAt] = useState<string | null>(null);
  const [pedidosCount, setPedidosCount] = useState(0);
  const [pendingTemplateCount, setPendingTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [bancoProcessing, setBancoProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/licencias/admin/editorial-report');
      const data = await res.json();
      setRows(data.rows ?? []);
      setBancoRows(data.bancoRows ?? []);
      setBancoReportAt(data.bancoReportAt ?? null);
      setPedidosCount(data.pedidosCount ?? 0);
      setPendingTemplateCount(data.pendingTemplateCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function descargar(url: string, filename: string, setBusy: (b: boolean) => void, okMsg: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        setMsg(await res.text());
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      setMsg(okMsg);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function procesarPago() {
    if (
      !confirm(
        `Se generará el CSV y se marcarán ${pedidosCount} pedido(s) como "pedidos a la editorial" (🧾). No podrás deshacerlo desde aquí. ¿Continuar?`,
      )
    )
      return;
    await descargar(
      '/api/licencias/admin/editorial-report/process',
      'Informe-editoriales-PAGO.csv',
      setProcessing,
      `Marcados ${pedidosCount} pedido(s) como pedidos a la editorial.`,
    );
  }

  async function procesarBanco() {
    const aviso = bancoReportAt
      ? `⚠️ Este informe ya se descargó el ${new Date(bancoReportAt).toLocaleString('es-ES')}.\n\nEs el censo COMPLETO del banco de libros, no solo lo nuevo: si lo vuelves a mandar a la editorial, pedirás otra vez licencias que ya pediste.\n\n¿Descargar de todas formas?`
      : 'Se descargará el censo completo de licencias gratis del banco de libros para pedírselas a la editorial. ¿Continuar?';
    if (!confirm(aviso)) return;
    await descargar(
      '/api/licencias/admin/editorial-report/banco',
      'Informe-editoriales-BANCO.csv',
      setBancoProcessing,
      'Informe del banco de libros descargado.',
    );
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

  // Total real a pedir a cada editorial: de pago + banco de libros. Es el número que se manda.
  const porEditorial = useMemo(() => {
    const acc = new Map<string, { editorial: string; pago: number; banco: number }>();
    for (const r of rows) {
      const e = acc.get(r.editorial) ?? { editorial: r.editorial, pago: 0, banco: 0 };
      e.pago += r.unidades;
      acc.set(r.editorial, e);
    }
    for (const r of bancoRows) {
      const e = acc.get(r.editorial) ?? { editorial: r.editorial, pago: 0, banco: 0 };
      e.banco += r.unidades;
      acc.set(r.editorial, e);
    }
    return [...acc.values()].sort((a, b) => a.editorial.localeCompare(b.editorial));
  }, [rows, bancoRows]);

  const totalPago = rows.reduce((s, r) => s + r.unidades, 0);
  const totalBanco = bancoRows.reduce((s, r) => s + r.unidades, 0);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {msg && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> {msg}
        </p>
      )}

      {/* Resumen: lo que hay que pedir a cada editorial, sumando pago + banco */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Total a pedir por editorial</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Lo que hay que pedirle a cada editorial: las licencias <strong>de pago pendientes</strong> más las{' '}
          <strong>gratis del banco de libros</strong>. Los dos informes se descargan por separado abajo.
        </p>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Editorial</th>
                <th className="px-3 py-2 text-right font-medium">De pago</th>
                <th className="px-3 py-2 text-right font-medium">Banco (gratis)</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {porEditorial.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-zinc-400">
                    Nada pendiente de pedir. ✅
                  </td>
                </tr>
              )}
              {porEditorial.map((e) => (
                <tr key={e.editorial} className="bg-white dark:bg-zinc-900">
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{e.editorial || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{e.pago || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{e.banco || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {e.pago + e.banco}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 1 · De pago */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <BookMarked className="h-4 w-4 text-purple-600" /> 1 · Licencias de pago ({totalPago})
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Licencias de pedidos <strong>aún no pedidos a la editorial</strong> (🧾), agrupadas por editorial/libro.
            El informe es <strong>incremental</strong>: al descargarlo, esos pedidos quedan marcados y ya no vuelven a
            salir. Si luego llegan pedidos nuevos, solo saldrán esos.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={procesarPago}
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
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No hay pedidos pendientes de procesar. ✅</p>
        ) : (
          <div className="mt-3">
            <TablaLibros rows={rows} />
          </div>
        )}
      </section>

      {/* 2 · Banco de libros (gratis) */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <Gift className="h-4 w-4 text-emerald-600" /> 2 · Banco de libros · gratis ({totalBanco})
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Licencias que el alumnado del banco de libros recibe <strong>sin pagar</strong>. No salen de los pedidos
            (un alumno del banco las tiene aunque no entre nunca en el formulario): son{' '}
            <strong>alumnos BdL × libros del banco de su curso</strong>, resueltos por idioma. A la editorial hay que
            pedírselas igual.
          </p>
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
            Este informe es el <strong>censo completo</strong>, no es incremental: sale todo, cada vez. Descárgalo una
            vez por campaña y vuelve a hacerlo solo si entra alumnado nuevo del banco (pidiendo entonces a la editorial
            únicamente la diferencia).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={procesarBanco}
              disabled={bancoProcessing || bancoRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
            >
              {bancoProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar informe del banco {totalBanco > 0 ? `(${totalBanco} licencias)` : ''}
            </button>
            {bancoReportAt && (
              <span className="text-xs text-zinc-500">
                Última descarga: {new Date(bancoReportAt).toLocaleString('es-ES')}
              </span>
            )}
          </div>
        </div>
        {bancoRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No hay licencias del banco de libros en esta campaña. Revisa que el catálogo tenga libros marcados como
            banco y que haya alumnado con banco de libros.
          </p>
        ) : (
          <div className="mt-3">
            <TablaLibros rows={bancoRows} gratis />
          </div>
        )}
      </section>
    </div>
  );
}
