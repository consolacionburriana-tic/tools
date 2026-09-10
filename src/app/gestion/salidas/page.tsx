export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth-guards';
import { getTripsForUser } from '@/lib/salidas-server';
import { SalidasList } from '@/components/salidas/salidas-list';

export const metadata = { title: 'Salidas · Gestión' };

export default async function SalidasListPage() {
  const user = (await getSessionUser())!;
  const trips = await getTripsForUser(user);
  const soloMias = user.role === 'profe' || user.role === 'tutor';

  return <SalidasList trips={trips} soloMias={soloMias} />;
}
