export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { estadoCuentas, type EstadoCuentas } from '@/lib/cuentas-server';
import { PanelCuentas } from '@/components/cuentas/panel';

export const metadata = { title: 'Correos y grupos · Tools Consolación' };

// Ficha: docs/30-cuentas.md. La pantalla sale de la foto de Neon; leer Google y todo lo que
// cambia algo lo hace la pantalla contra /api/cuentas/*.
export default async function CuentasPage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const puedeGestionar = canAccess(user, 'cuentas');
  // Leer Google es suplantar a un administrador: TIC lo es; quien solo ve, si hay buzón fijo.
  const puedeLeer = puedeGestionar || !!process.env.GOOGLE_ADMIN_BUZON;
  let estado: EstadoCuentas;
  const [{ persona }] = await Promise.all([searchParams]);
  try {
    estado = await estadoCuentas();
  } catch (e) {
    console.error('Cuentas: error leyendo el estado:', e instanceof Error ? e.message : e);
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        No se puede leer el estado de las cuentas. ¿Está aplicado el SQL de Correos y grupos en Neon? (pnpm db:sql --pendientes)
      </p>
    );
  }
  return (
    <PanelCuentas
      inicial={estado}
      puedeGestionar={puedeGestionar}
      puedeLeer={puedeLeer}
      personaInicial={persona && /^[ap]:[0-9a-f-]{36}$/.test(persona) ? persona : null}
    />
  );
}
