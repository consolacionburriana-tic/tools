export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { datosInicio } from '@/lib/tableros-server';
import { InicioTableros } from '@/components/tableros/inicio';

export const metadata = { title: 'Tableros · Tools Consolación' };

export default async function TablerosPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const datos = await datosInicio(user.email);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <InicioTableros inicial={datos} yo={user.email} />
    </main>
  );
}
