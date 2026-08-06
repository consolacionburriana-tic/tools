export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, Download } from 'lucide-react';
import { getCurrentCampaign } from '@/lib/licencias-server';
import {
  getEducamosRows,
  getEnviarRows,
  getGratisRows,
  getPagosConsolidado,
  getPagosPorLibro,
} from '@/lib/licencias-exports';

export const metadata = { title: 'Exportar · Licencias' };

function ExportCard({ tipo, titulo, desc, n }: { tipo: string; titulo: string; desc: string; n: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">{titulo}</p>
        <p className="text-xs text-zinc-500">{desc}</p>
      </div>
      <span className="shrink-0 text-sm text-zinc-400">{n} filas</span>
      <a
        href={`/api/licencias/admin/export?tipo=${tipo}`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
          n > 0
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'pointer-events-none bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
        }`}
      >
        <Download className="h-4 w-4" /> CSV
      </a>
    </div>
  );
}

export default async function ExportarPage() {
  const campaign = await getCurrentCampaign();
  const [enviar, gratis, pagos, educamos, libros] = campaign
    ? await Promise.all([
        getEnviarRows(campaign.id),
        getGratisRows(campaign.id),
        getPagosConsolidado(campaign.id),
        getEducamosRows(campaign.id),
        getPagosPorLibro(campaign.id),
      ])
    : [[], [], [], [], []];

  const enviarSi = enviar.filter((r) => r.grupo === 'SI').length;
  const enviarNo = enviar.filter((r) => r.grupo === 'NO').length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Exportar</h1>
            <p className="text-xs text-zinc-500">{campaign?.name ?? 'Sin campaña'}</p>
          </div>
          <Link
            href="/gestion/licencias"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Plantillas de envío (FormMule)</h2>
        <ExportCard tipo="enviar-no" titulo="ENVIAR · NO Banco de Libros" desc="Una fila por licencia de pago de alumnos no-BdL" n={enviarNo} />
        <ExportCard tipo="enviar-si" titulo="ENVIAR · SÍ Banco de Libros" desc="Licencias de pago de alumnos del banco (inglés, francés…)" n={enviarSi} />
        <ExportCard tipo="gratis" titulo="ENVIAR · GRATIS Banco de Libros" desc="Libros del banco (gratis) para cada alumno BdL" n={gratis.length} />

        <h2 className="pt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Pagos</h2>
        <ExportCard tipo="pagos" titulo="Pagos consolidado" desc="Total por alumno" n={pagos.length} />
        <ExportCard tipo="educamos" titulo="Educamos" desc="ID Educamos + importe (por curso)" n={educamos.length} />
        <ExportCard tipo="libros" titulo="Pagos por libro" desc="Unidades por libro/editorial" n={libros.length} />

        <p className="pt-3 text-xs text-zinc-400">
          Estas descargas CSV son el equivalente a las hojas del Google Sheet (las pegas o las usa FormMule).
          La escritura directa en el Google Sheet llegará cuando configuremos la cuenta de servicio de Google.
          La columna «Licencia Activación» va vacía para que la rellenes con los códigos de las editoriales.
        </p>
      </main>
    </div>
  );
}
