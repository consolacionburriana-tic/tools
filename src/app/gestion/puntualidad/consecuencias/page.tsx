export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { alcanceClases, listarConsecuencias } from '@/lib/puntualidad-server';
import { ConsecuenciasPanel } from '@/components/puntualidad/consecuencias-panel';

export const metadata = { title: 'Consecuencias · Puntualidad · Tools Consolación' };

export default async function ConsecuenciasPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const consecuencias = await listarConsecuencias({ clases: await alcanceClases(user) });
  return <ConsecuenciasPanel consecuencias={consecuencias} puedeCrear />;
}
