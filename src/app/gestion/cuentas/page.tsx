export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { estadoCuentas, type EstadoCuentas } from '@/lib/cuentas-server';
import { PanelCuentas } from '@/components/cuentas/panel';
import { Aviso } from '@/components/ui/aviso';

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
      <>
        <h1 className="sr-only">Correos y grupos</h1>
        <Aviso tono="aviso" titulo="No se puede leer el estado de las cuentas">
          ¿Está aplicado el SQL de Correos y grupos en Neon? (<code className="font-mono text-xs">pnpm db:sql --pendientes</code>)
        </Aviso>
      </>
    );
  }
  return (
    <>
      <h1 className="sr-only">Correos y grupos</h1>
      <PanelCuentas
        inicial={estado}
        puedeGestionar={puedeGestionar}
        puedeLeer={puedeLeer}
        personaInicial={persona && /^[ap]:[0-9a-f-]{36}$/.test(persona) ? persona : null}
      />
    </>
  );
}
