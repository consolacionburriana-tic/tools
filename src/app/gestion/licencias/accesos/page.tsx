export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { AccesosPanel } from '@/components/licencias/accesos-panel';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { buttonVariants } from '@/components/ui/button';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Vacio } from '@/components/ui/vacio';
import { getCurrentCampaign, getEstadoAccesos } from '@/lib/licencias-server';

export const metadata = { title: 'Enlaces de familias · Licencias' };

// Días de validez de los enlaces nuevos. Mismo valor que usa la API por defecto: cubre de
// sobra una campaña (apertura en julio → cierre en octubre) sin dejarlos vivos para siempre.
const DIAS_VALIDEZ = 120;

export default async function AccesosPage() {
  const campaign = await getCurrentCampaign();
  const estado = campaign ? await getEstadoAccesos(campaign.id) : null;

  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Enlaces de familias"
      descripcion={campaign?.name}
      acciones={
        <Link href="/gestion/licencias/correos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Mail aria-hidden /> Correos
        </Link>
      }
    >
      {!campaign || !estado ? (
        <Vacio titulo="No hay campaña activa" />
      ) : (
        <>
          <div className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Cada familia (cada <strong className="text-zinc-900 dark:text-zinc-100">correo de tutor</strong> de la
              BBDD central) tiene un enlace propio que identifica a{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">todos sus hijos</strong> sin teclear DNI ni
              contraseñas: <Etiqueta mono>/licencias?t=tok_…</Etiqueta>
            </p>
            <p>
              Si el mismo correo aparece en varios hermanos, se combinan en un solo enlace. El enlace vale para varias
              visitas (pedir un hijo, luego otro, o editar el pedido) hasta que caduque.
            </p>
          </div>
          <AccesosPanel inicial={estado} diasValidez={DIAS_VALIDEZ} />
        </>
      )}
    </Subpantalla>
  );
}
