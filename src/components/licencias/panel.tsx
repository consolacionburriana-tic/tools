import Link from 'next/link';
import {
  BookMarked,
  CalendarClock,
  ChevronDown,
  Download,
  KeyRound,
  Languages,
  Layers,
  ListOrdered,
  Mail,
  Map,
  PiggyBank,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { campaignAbierta, cierreAutomaticoResumen, diasHastaCierre, fechaLimiteLabel } from '@/lib/licencias';
import type { DashboardStats } from '@/lib/licencias-server';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Estado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo, TarjetaEnlace } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { CampanaEstado } from './campana-estado';

// La portada de Licencias: la campaña (abrir, cerrar, fecha de cierre), las cifras y el
// índice de todas las pantallas del módulo, agrupadas por el momento de la campaña en que
// se usan.

export interface CampanaPanel {
  name: string;
  status: string;
  orderDeadline: string | null;
  noteText: string | null;
}

const GRUPOS: { titulo: string; enlaces: { href: string; titulo: string; descripcion: string; icono: React.ReactNode }[] }[] = [
  {
    titulo: 'Durante la campaña',
    enlaces: [
      { href: '/gestion/licencias/proceso', titulo: 'Esquema del proceso', descripcion: 'Las cinco fases, paso a paso y con qué botón', icono: <Map /> },
      { href: '/gestion/licencias/pedidos', titulo: 'Pedidos', descripcion: 'Listado, edición, archivo y cobro de cada pedido', icono: <ListOrdered /> },
      { href: '/gestion/licencias/faltan', titulo: 'Quién falta', descripcion: 'Alumnado sin pedido, por clase', icono: <Users /> },
      { href: '/gestion/licencias/correos', titulo: 'Correos', descripcion: 'Apertura del plazo, recordatorios y avisos', icono: <Mail /> },
      { href: '/gestion/licencias/accesos', titulo: 'Enlaces de familias', descripcion: 'El enlace propio de cada familia', icono: <KeyRound /> },
    ],
  },
  {
    titulo: 'Al cerrar',
    enlaces: [
      { href: '/gestion/licencias/editoriales', titulo: 'Editoriales', descripcion: 'Generar y mandar los pedidos', icono: <BookMarked /> },
      { href: '/gestion/licencias/envios', titulo: 'Envío de licencias', descripcion: 'Pegar los códigos y mandárselos a cada alumno', icono: <Send /> },
      { href: '/gestion/licencias/economia', titulo: 'Económica', descripcion: 'Ingresos, cobros y ficheros para Educamos', icono: <PiggyBank /> },
      { href: '/gestion/licencias/exportar', titulo: 'Exportar', descripcion: 'Las descargas CSV de las hojas de siempre', icono: <Download /> },
    ],
  },
  {
    titulo: 'Preparar el catálogo',
    enlaces: [
      { href: '/gestion/licencias/lenguas', titulo: 'Idioma por clase', descripcion: 'Castellano o valencià, clase a clase', icono: <Languages /> },
      { href: '/gestion/licencias/packs', titulo: 'Packs e itinerarios', descripcion: 'Agrupan las licencias para guiar a las familias', icono: <Layers /> },
      { href: '/gestion/licencias/sincronizar', titulo: 'Sincronizar', descripcion: 'Puentes con el Google Sheet histórico', icono: <RefreshCw /> },
    ],
  },
];

function Campana({ campaign }: { campaign: CampanaPanel }) {
  const abierta = campaignAbierta(campaign);
  const diasCierre = diasHastaCierre(campaign.orderDeadline);
  const cierreUrgente = abierta && diasCierre !== null && diasCierre <= 3;
  return (
    <Tarjeta as="section" aria-labelledby="campana-titulo">
      <TarjetaCabecera
        id="campana-titulo"
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {campaign.name}
            <Estado tono={abierta ? 'ok' : campaign.status === 'draft' ? 'neutro' : 'aviso'}>
              {abierta ? 'Abierta' : campaign.status === 'draft' ? 'Borrador' : 'Cerrada'}
            </Estado>
          </span>
        }
        descripcion={abierta ? 'Las familias pueden pedir con su enlace.' : 'Las familias no pueden pedir ahora.'}
        accion={<CampanaEstado abierta={campaign.status === 'open'} />}
      />
      <TarjetaCuerpo className="space-y-3">
        {!abierta && campaign.orderDeadline && (
          <Aviso tono="aviso">El plazo de petición de licencias se cerró el {fechaLimiteLabel(campaign.orderDeadline)}.</Aviso>
        )}
        <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span
              className={cn(
                'flex items-center gap-2 font-medium',
                cierreUrgente ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-700 dark:text-zinc-300',
              )}
            >
              <CalendarClock aria-hidden className="size-4 shrink-0" />
              {cierreAutomaticoResumen(campaign.orderDeadline)}
            </span>
            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              Cambiar
              <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
            </span>
          </summary>
          <form
            action="/api/licencias/admin/campaign"
            method="post"
            className="space-y-4 border-t border-zinc-200 p-3 dark:border-zinc-800"
          >
            <Campo etiqueta="Cierre automático" id="orderDeadline" ayuda="Se cierra a las 23:59 de ese día.">
              <Input
                id="orderDeadline"
                type="date"
                name="orderDeadline"
                defaultValue={campaign.orderDeadline ?? ''}
                className="sm:max-w-56"
              />
            </Campo>
            <Campo
              etiqueta="Texto informativo"
              id="noteText"
              ayuda="Sale bajo el título del formulario de las familias."
              opcional
            >
              <Textarea
                id="noteText"
                name="noteText"
                rows={2}
                defaultValue={campaign.noteText ?? ''}
                placeholder="Las licencias digitales no son obligatorias. Marca solo las que quieras solicitar."
              />
            </Campo>
            <Button type="submit" variant="outline">
              Guardar fecha y texto
            </Button>
          </form>
        </details>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

export function PanelLicencias({ campaign, stats }: { campaign: CampanaPanel | null; stats: DashboardStats | null }) {
  const pct = stats && stats.totalStudents > 0 ? Math.round((stats.conPedido / stats.totalStudents) * 100) : 0;

  return (
    <div className="space-y-6">
      {campaign ? (
        <Campana campaign={campaign} />
      ) : (
        <Vacio icono={<CalendarClock />} titulo="No hay campaña activa">
          Cuando se cree la campaña del curso, aquí verás su estado y sus cifras.
        </Vacio>
      )}

      {stats && (
        <Cifras>
          <Cifra etiqueta="Alumnos" valor={stats.totalStudents} />
          <Cifra etiqueta="Con pedido" valor={stats.conPedido} nota={`${pct} % del alumnado`} barra={pct / 100} />
          <Cifra
            etiqueta="Faltan"
            valor={stats.sinPedido}
            nota={stats.noHaranPedido > 0 ? `y ${stats.noHaranPedido} no harán pedido` : 'Ver quién'}
            href="/gestion/licencias/faltan"
          />
          <Cifra etiqueta="Licencias" valor={stats.totalLicencias} />
        </Cifras>
      )}

      {GRUPOS.map((g) => (
        <section key={g.titulo} aria-label={g.titulo}>
          <Rotulo className="mb-2">{g.titulo}</Rotulo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.enlaces.map((e) => (
              <TarjetaEnlace key={e.href} href={e.href} titulo={e.titulo} descripcion={e.descripcion} icono={e.icono} />
            ))}
          </div>
        </section>
      ))}

      {stats && (
        <section aria-labelledby="por-curso">
          <Rotulo id="por-curso" className="mb-2">
            Por curso
          </Rotulo>
          <Tarjeta className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Curso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Alumnos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Con pedido</th>
                  <th className="px-4 py-2.5 text-right font-medium">Faltan</th>
                  <th className="px-4 py-2.5 text-right font-medium">No pedirán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums dark:divide-zinc-800">
                {stats.porCurso.map((c) => {
                  const pdc = c.curso.endsWith('PDC');
                  return (
                    <tr key={c.curso} className={pdc ? 'bg-zinc-50/60 dark:bg-zinc-800/30' : undefined}>
                      <td
                        className={cn(
                          'py-2.5',
                          pdc ? 'pl-9 text-zinc-600 dark:text-zinc-400' : 'px-4 font-medium text-zinc-900 dark:text-zinc-100',
                        )}
                      >
                        {pdc ? `↳ ${c.curso}` : c.curso}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 dark:text-zinc-300">{c.total}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 dark:text-zinc-300">{c.conPedido}</td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right font-medium',
                          c.sinPedido > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400',
                        )}
                      >
                        {c.sinPedido}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                        {c.noHaranPedido > 0 ? c.noHaranPedido : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tarjeta>
        </section>
      )}

      {stats && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          La escritura directa en el Google Sheet está en «Sincronizar» (a falta de comprobarla de punta a punta con la
          cuenta de servicio). La sincronización con la API de Educamos sigue pendiente de acceso: hoy el cobro se pasa
          con el CSV de «Económica».
        </p>
      )}
    </div>
  );
}
