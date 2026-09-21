export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EnviosPanel } from '@/components/licencias/envios-panel';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { PLANTILLAS_LICENCIA } from '@/lib/licencias-email';

export const metadata = { title: 'Envío de licencias · Licencias' };

export default async function EnviosPage() {
  const campaign = await getCurrentCampaign();
  return (
    // Más ancho que el resto del panel a propósito: esto es una hoja de cálculo, no un
    // formulario, y con `max-w-3xl` las columnas del código y del destino no caben.
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Envío de licencias</h1>
            <p className="text-xs text-zinc-500">Pegar los códigos que llegan y mandárselos a cada alumno</p>
          </div>
          <Link
            href="/gestion/licencias"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {campaign ? (
          <EnviosPanel
            presets={PLANTILLAS_LICENCIA.map((p) => ({
              clave: p.clave,
              nombre: p.nombre,
              subject: p.subject,
              body: p.body,
            }))}
          />
        ) : (
          <p className="text-sm text-zinc-500">No hay campaña activa.</p>
        )}
      </main>
    </div>
  );
}
