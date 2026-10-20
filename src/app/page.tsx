export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { getSessionUser } from '@/lib/auth-guards';
import { getAccesosPortada } from '@/lib/portada-server';
import { HomeLanding } from '@/components/home/home-landing';

// La portada cambia con lo que el colegio esté gestionando (campaña de licencias, salidas
// cobrando…), así que se renderiza en cada visita. Ver `src/lib/portada.ts` y docs/22-portada.md.
//
// Con sesión del claustro, entrar por la raíz lleva directo al escritorio: la portada es para
// las familias. Desde el escritorio, «Ver como familia» (`?vista=familia`) la enseña tal cual.
// Una cuenta del colegio que no es del claustro (alumnado) se queda aquí, que es su sitio.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const [user, { vista }] = await Promise.all([getSessionUser(), searchParams]);
  const comoFamilia = vista === 'familia';
  if (user?.role && !comoFamilia) redirect('/gestion');
  const accesos = await getAccesosPortada();
  return (
    <HomeLanding
      accesos={accesos}
      sesion={user ? { email: user.email, claustro: !!user.role } : null}
      salir={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    />
  );
}
