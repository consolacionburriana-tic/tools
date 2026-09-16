'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookMarked, Check, Download, Gift, Loader2, MoreHorizontal, Send, TriangleAlert } from 'lucide-react';
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
            // La identidad de un libro es curso + código: `3ESO-REL` está en 3ESO y en 3PDC.
            <tr key={`${r.curso}|${r.cod}`} className="bg-white dark:bg-zinc-900">
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
  const [sinLengua, setSinLengua] = useState(0);
  const [hayBilingues, setHayBilingues] = useState(false);
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
      setSinLengua(data.bancoAlumnosSinLengua ?? 0);
      setHayBilingues(!!data.bancoHayBilingues);
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
      ? `Este informe ya se descargó el ${new Date(bancoReportAt).toLocaleString('es-ES')}.\n\nSale el censo entero, no solo lo nuevo. ¿Descargar de todas formas?`
      : 'Se descargará el censo del banco de libros para pedírselo a la editorial. ¿Continuar?';
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Dos pedidos distintos, nunca uno</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Las licencias <strong>de pago</strong> y las <strong>gratis del banco de libros</strong> se piden por vías
          separadas y no se suman: son dos pedidos, dos envíos y dos facturas.
        </p>
      </div>

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
          <div className="mt-3">
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
            Censo de lo que hace falta pedir para el banco de libros: cuántas licencias de cada libro y de cada
            curso. No sale de los pedidos (un alumno del banco las tiene aunque no entre nunca en el formulario):
            son <strong>alumnos BdL × libros del banco de su curso</strong>, resueltos por idioma.
          </p>
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
            Este informe es el <strong>censo completo</strong>, no es incremental: sale todo, cada vez. Descárgalo una
            vez por campaña y vuelve a hacerlo solo si entra alumnado nuevo del banco (pidiendo entonces a la editorial
            únicamente la diferencia).
          </p>
          {hayBilingues && sinLengua > 0 && (
            <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-200">
              <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
              Hay {sinLengua} alumno(s) sin idioma asignado, y los libros que tienen las dos versiones se reparten
              con ese dato: sin él salen todos <strong>en castellano</strong>. Se pone clase a clase en{' '}
              <Link href="/gestion/licencias/lenguas" className="font-semibold underline">
                Idioma por clase
              </Link>
              .
            </p>
          )}
          {bancoReportAt && (
            <p className="mt-3 text-xs text-zinc-500">
              Último CSV descargado: {new Date(bancoReportAt).toLocaleString('es-ES')}
            </p>
          )}
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

      {/* Lo de antes de los Google Sheets, por si hace falta el fichero suelto */}
      <details className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
          <MoreHorizontal className="h-4 w-4" /> Otras opciones · descargar el CSV
        </summary>
        <div className="space-y-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Los mismos datos en CSV, con el formato de las hojas del Excel de siempre. El de pago{' '}
            <strong>marca los pedidos</strong> al descargarlo, igual que el paso 3 de arriba: no hace falta usar los
            dos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={procesarPago}
              disabled={processing || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV de pago y marcar {pedidosCount > 0 ? `(${pedidosCount} pedidos)` : ''}
            </button>
            <button
              type="button"
              onClick={procesarBanco}
              disabled={bancoProcessing || bancoRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {bancoProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV del banco {totalBanco > 0 ? `(${totalBanco} licencias)` : ''}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
