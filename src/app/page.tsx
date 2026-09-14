export const dynamic = 'force-dynamic';

import { getAccesosPortada } from '@/lib/portada-server';
import { HomeLanding } from '@/components/home/home-landing';

// La portada cambia con lo que el colegio esté gestionando (campaña de licencias, salidas
// cobrando…), así que se renderiza en cada visita. Ver `src/lib/portada.ts`.
export default async function HomePage() {
  const accesos = await getAccesosPortada();
  return <HomeLanding accesos={accesos} />;
}
