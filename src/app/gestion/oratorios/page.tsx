export const dynamic = 'force-dynamic';

import { HandHeart } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PESTANAS_ORA } from '@/lib/oratorios';
import { accesoComunActivo, getDatosPanel, getMisSesiones } from '@/lib/oratorios-server';
import { PanelOratorios, type Pestana } from '@/components/oratorios/panel';
import { MisOratorios } from '@/components/oratorios/mis-oratorios';
import { Vacio } from '@/components/ui/vacio';

export const metadata = { title: 'Oratorios, Godly Play y Talleres · Gestión' };

// Ficha: docs/26-oratorios.md. Quien lo lleva (`oratorios`) recibe el curso entero y planifica;
// el claustro (`oratorios-ver`) ve solo lo suyo, y solo si el acceso común está encendido.
export default async function OratoriosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  if (canAccess(user, 'oratorios')) {
    const [datos, { tab }] = await Promise.all([getDatosPanel(user), searchParams]);
    const tabInicial: Pestana = (PESTANAS_ORA as readonly string[]).includes(tab ?? '') ? (tab as Pestana) : 'planificar';
    return (
      <>
        <h1 className="sr-only">Oratorios, Godly Play y Talleres</h1>
        <PanelOratorios datos={datos} tabInicial={tabInicial} />
      </>
    );
  }

  if (!(await accesoComunActivo())) {
    return (
      <>
        <h1 className="sr-only">Oratorios, Godly Play y Talleres</h1>
        <Vacio icono={<HandHeart />} titulo="Todavía no está abierto al claustro">
          Cuando quien lo lleva lo abra, aquí verás las sesiones que te tocan.
        </Vacio>
      </>
    );
  }
  const datos = await getMisSesiones(user.email);
  return (
    <>
      <h1 className="sr-only">Mis oratorios</h1>
      <MisOratorios datos={datos} email={user.email} />
    </>
  );
}
