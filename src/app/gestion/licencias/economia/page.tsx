export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { getCurrentCampaign, getDashboardStats } from '@/lib/licencias-server';
import { euros } from '@/lib/licencias';

export const metadata = { title: 'Gestión económica · Licencias' };

const FICHEROS = [
  { tipo: 'educamos', titulo: 'Educamos', desc: 'ID + importe, para cargar el cobro' },
  { tipo: 'pagos', titulo: 'Pagos consolidado', desc: 'Total por alumno' },
  { tipo: 'libros', titulo: 'Pagos por libro', desc: 'Unidades por libro/editorial' },
];

export default async function EconomiaPage() {
  const campaign = await getCurrentCampaign();
  const stats = campaign ? await getDashboardStats(campaign.id) : null;
  const conIngresos = stats?.porCurso.filter((c) => c.conPedido > 0) ?? [];

  return (
    <Subpantalla ancho="medio" titulo="Gestión económica" descripcion={campaign?.name}>
      {!stats ? (
        <Vacio titulo="No hay campaña activa" />
      ) : (
        <div className="space-y-6">
          <Cifras className="sm:grid-cols-3">
            <Cifra etiqueta="Ingresos previstos" valor={euros(stats.ingresos)} nota="Pedidos confirmados" />
            <Cifra etiqueta="Cobrado" valor={euros(stats.cobrado)} nota="Marcado como pagado en Pedidos" />
            <Cifra etiqueta="Pendiente de cobro" valor={euros(stats.ingresos - stats.cobrado)} />
          </Cifras>

          <section aria-labelledby="eco-curso">
            <Rotulo id="eco-curso" className="mb-2">
              Por curso
            </Rotulo>
            <Tarjeta className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Curso</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pedidos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ingresos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums dark:divide-zinc-800">
                  {conIngresos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-zinc-500 dark:text-zinc-400">
                        Aún no hay pedidos.
                      </td>
                    </tr>
                  )}
                  {conIngresos.map((c) => (
                    <tr key={c.curso}>
                      <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{c.curso}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 dark:text-zinc-300">{c.conPedido}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        {euros(c.ingresos)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 dark:text-zinc-300">
                        {c.cobrado > 0 ? euros(c.cobrado) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          </section>

          <section aria-labelledby="eco-ficheros">
            <Rotulo id="eco-ficheros" className="mb-2">
              Ficheros
            </Rotulo>
            <div className="grid gap-3 sm:grid-cols-3">
              {FICHEROS.map((f) => (
                <a
                  key={f.tipo}
                  href={`/api/licencias/admin/export?tipo=${f.tipo}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Download aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{f.titulo}</span>
                    <span className="block text-zinc-500 dark:text-zinc-400">{f.desc}</span>
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Marcar quién ha pagado se hace en{' '}
              <Link href="/gestion/licencias/pedidos" className="font-medium text-blue-700 underline dark:text-blue-400">
                Pedidos
              </Link>{' '}
              (columna «Pagado»).
            </p>
          </section>
        </div>
      )}
    </Subpantalla>
  );
}
