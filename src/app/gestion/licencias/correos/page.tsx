export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { CorreosForm } from '@/components/licencias/correos-form';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { buttonVariants } from '@/components/ui/button';
import { Vacio } from '@/components/ui/vacio';
import { appBaseUrl } from '@/lib/constants';
import { getClasesCampaign, getCurrentCampaign } from '@/lib/licencias-server';

export const metadata = { title: 'Correos · Licencias' };

export default async function CorreosPage() {
  const campaign = await getCurrentCampaign();
  const clases = campaign ? await getClasesCampaign(campaign.id) : [];

  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Correos"
      descripcion="Apertura del plazo, recordatorios y avisos a las familias."
      acciones={
        <Link href="/gestion/licencias/accesos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <KeyRound aria-hidden /> Enlaces
        </Link>
      }
    >
      {!campaign ? (
        <Vacio titulo="No hay campaña activa" />
      ) : (
        <CorreosForm
          clases={clases}
          deadline={campaign.orderDeadline}
          academicYear={campaign.academicYear}
          baseUrl={appBaseUrl()}
        />
      )}
    </Subpantalla>
  );
}
