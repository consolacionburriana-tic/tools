export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, puedeEditarProteccionDatos, puedeGestionarMateriales, puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { fichaNouvingut } from '@/lib/nouvinguts-server';
import { FichaNouvinguts } from '@/components/nouvinguts/ficha';

export const metadata = { title: 'Nouvinguts · Tools Consolación' };

export default async function FichaNouvingutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ficha = await fichaNouvingut(id, user.role);
  if (!ficha) notFound();
  return (
    <FichaNouvinguts
      key={ficha.id}
      inicial={ficha}
      puede={{
        correo: canAccess(user, 'cuentas'),
        proteccion: puedeEditarProteccionDatos(user.role),
        participantes: puedeGestionarParticipantesBanco(user.role),
        materiales: puedeGestionarMateriales(user.role),
      }}
    />
  );
}
