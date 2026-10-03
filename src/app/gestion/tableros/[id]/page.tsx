export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { datosTablero } from '@/lib/tableros-server';
import { VistaTablero } from '@/components/tableros/tablero';

export const metadata = { title: 'Tablero · Tools Consolación' };

// Quien no es miembro del equipo recibe lo mismo que si el tablero no existiera.
export default async function TableroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const datos = await datosTablero(user.email, id);
  if (!datos) notFound();
  return <VistaTablero key={id} inicial={datos} tarjetaInicial={t ?? null} />;
}
