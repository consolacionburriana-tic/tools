export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
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
    <Tarjeta className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      <span className="shrink-0 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{n} filas</span>
      {n > 0 ? (
        <a
          href={`/api/licencias/admin/export?tipo=${tipo}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download aria-hidden /> CSV
        </a>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <Download aria-hidden /> CSV
        </Button>
      )}
    </Tarjeta>
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
    <Subpantalla ancho="estrecho" titulo="Exportar" descripcion={campaign?.name}>
      <div className="space-y-3">
        <Aviso tono="info">
          Los códigos ya se pegan y se mandan desde la app, en{' '}
          <Link href="/gestion/licencias/envios" className="font-semibold underline">
            Envío de licencias
          </Link>
          . Estas descargas se quedan como salvavidas: son el mismo formato de las hojas del Sheet, por si algún día hay
          que hacerlo a mano.
        </Aviso>
        <Rotulo className="pt-3">Plantillas de envío (FormMule)</Rotulo>
        <ExportCard tipo="enviar-no" titulo="ENVIAR · NO Banco de Libros" desc="Una fila por licencia de pago de alumnos no-BdL" n={enviarNo} />
        <ExportCard tipo="enviar-si" titulo="ENVIAR · SÍ Banco de Libros" desc="Licencias de pago de alumnos del banco (inglés, francés…)" n={enviarSi} />
        <ExportCard tipo="gratis" titulo="ENVIAR · GRATIS Banco de Libros" desc="Libros del banco (gratis) para cada alumno BdL" n={gratis.length} />

        <Rotulo className="pt-3">Pagos</Rotulo>
        <ExportCard tipo="pagos" titulo="Pagos consolidado" desc="Total por alumno" n={pagos.length} />
        <ExportCard tipo="educamos" titulo="Educamos" desc="ID Educamos + importe (por curso)" n={educamos.length} />
        <ExportCard tipo="libros" titulo="Pagos por libro" desc="Unidades por libro/editorial" n={libros.length} />

        <p className="pt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Estas descargas CSV son el equivalente a las hojas del Google Sheet (las pegas o las usa FormMule). La columna
          «Licencia Activación» va vacía para que la rellenes con los códigos de las editoriales: si en vez de eso los
          pegas en Envío de licencias, la app manda los correos y va marcando una a una las enviadas.
        </p>
      </div>
    </Subpantalla>
  );
}
