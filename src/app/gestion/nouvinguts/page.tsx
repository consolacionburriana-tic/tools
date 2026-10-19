export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { listaNouvinguts } from '@/lib/nouvinguts-server';
import { ListaNouvinguts } from '@/components/nouvinguts/lista';

export const metadata = { title: 'Nouvinguts · Tools Consolación' };

export default async function NouvingutsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const { nouvinguts, proceso, ajustes } = await listaNouvinguts('abierto', user.role);
  return (
    <ListaNouvinguts
      iniciales={nouvinguts}
      proceso={proceso}
      diasAtasco={ajustes.diasAtasco}
      puedeProceso={canAccess(user, 'nouvinguts-proceso')}
    />
  );
}
