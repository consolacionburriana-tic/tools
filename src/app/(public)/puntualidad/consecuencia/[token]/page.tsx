export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { consecuenciaPorToken } from '@/lib/puntualidad-server';
import { ConsecuenciaForm } from '@/components/puntualidad/consecuencia-form';

export const metadata = {
  title: 'Consecuencia por retrasos · Consolación',
};

// Enlace de un clic del correo al tutor/a: sin login (el token es la credencial, caduca a
// los 60 días y solo abre esta consecuencia). La misma pantalla se usa desde el panel.
export default async function ConsecuenciaTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const consecuencia = await consecuenciaPorToken(token);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="container mx-auto flex h-14 max-w-xl items-center gap-2.5 px-4">
          <Image src="/logobur.png" alt="" width={24} height={24} className="rounded" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Puntualidad</span>
        </div>
      </header>

      <main className="container mx-auto max-w-xl px-4 py-6">
        {consecuencia ? (
          <ConsecuenciaForm
            consecuencia={consecuencia}
            endpoint={`/api/puntualidad/consecuencia/${token}`}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Este enlace ya no es válido</p>
            <p className="mt-1 text-sm text-zinc-500">
              Puede que haya caducado o que la consecuencia se haya borrado. Se puede gestionar igual desde el panel de
              Puntualidad, entrando con tu cuenta del colegio.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
