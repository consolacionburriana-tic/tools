export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { BancoSyncPanel } from '@/components/bancolibros/sync-panel';

export const metadata = { title: 'Sincronizar · Banco de libros' };

export default async function SincronizarBancoPage() {
  const user = await getSessionUser();
  const puede = puedeGestionarParticipantesBanco(user?.role ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Sincronizar</h1>
          <p className="text-xs text-zinc-500">Puente bajo demanda entre el Excel de libros y el catálogo del banco</p>
        </div>
        <Link
          href="/gestion/bancolibros"
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <ChevronLeft className="h-4 w-4" /> Panel
        </Link>
      </div>

      {puede ? (
        <BancoSyncPanel />
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Solo dirección/TIC pueden sincronizar el catálogo de libros.
        </p>
      )}
    </div>
  );
}
