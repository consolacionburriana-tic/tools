export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, Mail } from 'lucide-react';
import { AccesosPanel } from '@/components/licencias/accesos-panel';
import { getCurrentCampaign, getEstadoAccesos } from '@/lib/licencias-server';

export const metadata = { title: 'Enlaces de familias · Licencias' };

// Días de validez de los enlaces nuevos. Mismo valor que usa la API por defecto: cubre de
// sobra una campaña (apertura en julio → cierre en octubre) sin dejarlos vivos para siempre.
const DIAS_VALIDEZ = 120;

export default async function AccesosPage() {
  const campaign = await getCurrentCampaign();
  const estado = campaign ? await getEstadoAccesos(campaign.id) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Enlaces de familias</h1>
            <p className="text-xs text-zinc-500">{campaign?.name ?? 'Sin campaña'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gestion/licencias/correos"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              <Mail className="h-4 w-4" /> Correos
            </Link>
            <Link
              href="/gestion/licencias"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              <ChevronLeft className="h-4 w-4" /> Panel
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!campaign || !estado ? (
          <p className="text-zinc-500">No hay campaña activa.</p>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <p>
                Cada familia (cada <strong>correo de tutor</strong> de la BBDD central) tiene un enlace propio que
                identifica a <strong>todos sus hijos</strong> sin teclear DNI ni contraseñas:
                <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                  /licencias?t=tok_…
                </code>
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Si el mismo correo aparece en varios hermanos, se combinan en un solo enlace. El enlace vale para varias
                visitas (pedir un hijo, luego otro, o editar el pedido) hasta que caduque.
              </p>
            </div>
            <AccesosPanel inicial={estado} diasValidez={DIAS_VALIDEZ} />
          </>
        )}
      </main>
    </div>
  );
}
