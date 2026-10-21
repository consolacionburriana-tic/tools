export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getProceso } from '@/lib/nouvinguts-server';
import { emailConfigurado } from '@/lib/email';
import { ProcesoNouvinguts } from '@/components/nouvinguts/proceso';

export const metadata = { title: 'Proceso · Nouvinguts · Tools Consolación' };

export default async function ProcesoPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'nouvinguts-proceso')) redirect('/gestion/sin-acceso');
  const { proceso, ajustes } = await getProceso();
  return (
    <>
      <h1 className="sr-only">Proceso de nouvinguts</h1>
      <ProcesoNouvinguts
        inicial={proceso}
        diasAtascoInicial={ajustes.diasAtasco}
        avisosInicial={ajustes.avisos}
        correoConfigurado={emailConfigurado()}
      />
    </>
  );
}
