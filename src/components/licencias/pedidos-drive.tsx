'use client';

import { useState } from 'react';
import { Check, ExternalLink, FileSpreadsheet, FileText, Loader2, Stamp, TriangleAlert } from 'lucide-react';
import { euros } from '@/lib/licencias';

interface Fichero {
  id: string;
  tiradaId: string;
  tipo: string;
  editorial: string;
  nombre: string;
  sheetUrl: string | null;
  pdfUrl: string | null;
  unidades: number;
  libros: number;
  importe: string;
  marcadoAt: string | null;
  createdAt: string;
}

interface Resumen {
  editorial: string;
  libros: number;
  unidades: number;
  importe: number;
}

export interface PedidosDriveProps {
  drive: { ok: boolean; cuenta: string | null; carpetaId: string; carpetaNombre?: string; error?: string };
  previa: { pago: Resumen[]; banco: Resumen[]; pedidosPendientes: number };
  tirada: Fichero[];
}

function Paso({
  n,
  texto,
  onClick,
  cargando,
  disabled,
  tono = 'azul',
  icono,
}: {
  n: number;
  texto: string;
  onClick: () => void;
  cargando: boolean;
  disabled: boolean;
  tono?: 'azul' | 'verde' | 'gris';
  icono: React.ReactNode;
}) {
  const colores = {
    azul: 'bg-blue-600 text-white hover:bg-blue-700',
    verde: 'bg-emerald-600 text-white hover:bg-emerald-700',
    gris: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
  }[tono];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || cargando}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 cursor-pointer ${colores}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15 text-[11px] font-bold">
        {n}
      </span>
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : icono}
      {texto}
    </button>
  );
}

export function PedidosDrive({ drive, previa, tirada: tiradaInicial }: PedidosDriveProps) {
  const [tirada, setTirada] = useState(tiradaInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalFicheros = previa.pago.length + previa.banco.length;
  const hayTirada = tirada.length > 0;
  const faltanPdf = tirada.some((f) => !f.pdfUrl);
  const sinMarcar = tirada.some((f) => !f.marcadoAt);

  async function accion(nombre: 'generar' | 'pdf' | 'marcar', confirmacion?: string) {
    if (confirmacion && !confirm(confirmacion)) return;
    setOcupado(nombre);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/licencias/admin/pedidos-editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: nombre }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'No se ha podido completar');
        return;
      }
      if (nombre === 'generar') {
        setTirada(data.ficheros ?? []);
        setMsg(`${data.ficheros?.length ?? 0} fichero(s) generados en Drive.`);
        if (data.errores?.length) setError(`${data.errores.length} fallaron: ${data.errores[0]?.error ?? ''}`);
      } else if (nombre === 'pdf') {
        setMsg(`${data.hechos?.length ?? 0} PDF creados.`);
        if (data.errores?.length) setError(`${data.errores.length} fallaron: ${data.errores[0]?.error ?? ''}`);
        await recargar();
      } else {
        setMsg(`Marcados ${data.pedidos ?? 0} pedidos como pedidos a la editorial.`);
        await recargar();
      }
    } catch {
      setError('No se ha podido completar');
    } finally {
      setOcupado(null);
    }
  }

  async function recargar() {
    const res = await fetch('/api/licencias/admin/pedidos-editorial');
    if (res.ok) setTirada((await res.json()).tirada ?? []);
  }

  if (!drive.ok) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
          <TriangleAlert className="h-4 w-4" /> Drive no está listo
        </p>
        <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">{drive.error}</p>
        {drive.cuenta && (
          <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-200/70">
            Comparte la carpeta de salida con <strong>{drive.cuenta}</strong> como Administrador de contenido, en una
            unidad compartida.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Un Google Sheet por editorial, y los de pago separados de los del banco de libros. Se dejan en{' '}
          <a
            href={`https://drive.google.com/drive/folders/${drive.carpetaId}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            {drive.carpetaNombre ?? 'la carpeta de Drive'}
          </a>
          .
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Ahora mismo saldrían <strong>{totalFicheros}</strong> ficheros: {previa.pago.length} de pago y{' '}
          {previa.banco.length} del banco.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Paso
            n={1}
            texto="Generar los pedidos"
            icono={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() =>
              accion(
                'generar',
                `Se crearán ${totalFicheros} Google Sheets en Drive (se reemplazan los que ya existan con el mismo nombre). ¿Continuar?`,
              )
            }
            cargando={ocupado === 'generar'}
            disabled={totalFicheros === 0 || ocupado !== null}
          />
          <Paso
            n={2}
            texto="Pasar a PDF"
            icono={<FileText className="h-4 w-4" />}
            tono="gris"
            onClick={() => accion('pdf')}
            cargando={ocupado === 'pdf'}
            disabled={!hayTirada || !faltanPdf || ocupado !== null}
          />
          <Paso
            n={3}
            texto="Marcar como pedidos"
            icono={<Stamp className="h-4 w-4" />}
            tono="verde"
            onClick={() =>
              accion(
                'marcar',
                `Se marcarán como pedidos a la editorial (🧾) los ${previa.pedidosPendientes} pedidos que entraron en estos ficheros. ¿Continuar?`,
              )
            }
            cargando={ocupado === 'marcar'}
            disabled={!hayTirada || !sinMarcar || ocupado !== null}
          />
        </div>

        {msg && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {msg}
          </p>
        )}
        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      {hayTirada && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Editorial</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Uds</th>
                <th className="px-3 py-2 text-right font-medium">Importe</th>
                <th className="px-3 py-2 text-right font-medium">Ficheros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {tirada.map((f) => (
                <tr key={f.id} className="bg-white dark:bg-zinc-900">
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{f.editorial}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        f.tipo === 'banco'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      }`}
                    >
                      {f.tipo === 'banco' ? 'Banco' : 'Pago'}
                    </span>
                    {f.marcadoAt && <span className="ml-1.5 text-xs text-zinc-400">🧾</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-600 dark:text-zinc-300">{f.unidades}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-500">{euros(parseFloat(f.importe || '0'))}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {f.sheetUrl && (
                        <a
                          href={f.sheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Sheet <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {f.pdfUrl ? (
                        <a
                          href={f.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
                        >
                          PDF <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-600">sin PDF</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
