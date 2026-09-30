export const dynamic = 'force-dynamic';

import { HandHeart } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PESTANAS_ORA } from '@/lib/oratorios';
import { accesoComunActivo, getDatosPanel, getMisSesiones } from '@/lib/oratorios-server';
import { PanelOratorios, type Pestana } from '@/components/oratorios/panel';
import { MisOratorios } from '@/components/oratorios/mis-oratorios';

export const metadata = { title: 'Oratorios y Godly Play · Gestión' };

// Ficha: docs/25-oratorios.md. Quien lo lleva (`oratorios`) recibe el curso entero y planifica;
// el claustro (`oratorios-ver`) ve solo lo suyo, y solo si el acceso común está encendido.
export default async function OratoriosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  if (canAccess(user, 'oratorios')) {
    const [datos, { tab }] = await Promise.all([getDatosPanel(user), searchParams]);
    const tabInicial: Pestana = (PESTANAS_ORA as readonly string[]).includes(tab ?? '') ? (tab as Pestana) : 'planificar';
    return <PanelOratorios datos={datos} tabInicial={tabInicial} />;
  }

  if (!(await accesoComunActivo())) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-zinc-600 dark:text-zinc-400">
        <HandHeart className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3">Todavía no está abierto al claustro.</p>
      </div>
    );
  }
  const datos = await getMisSesiones(user.email);
  return <MisOratorios datos={datos} email={user.email} />;
}
