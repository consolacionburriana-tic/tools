export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, moduloDesactivado } from '@/lib/permissions';
import { ensureSubjects } from '@/lib/puntualidad-server';
import { getTeacherByEmail } from '@/lib/educamos-server';
import { PuntualidadForm } from '@/components/puntualidad/puntualidad-form';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { CONFIGURACION } from '@/lib/configuracion';

export const metadata = {
  title: 'Puntualidad · Consolación',
  description: 'Registro de retrasos de entrada',
};

// Detrás del login del claustro: registrar un retraso lo puede hacer cualquier profe
// (igual que el formulario del ABC). El panel de datos sí es del módulo `puntualidad`, así
// que el enlace a él solo sale a quien puede abrirlo.
export default async function PuntualidadPage() {
  // Apagado en configuracion.ts: el formulario no se abre (vuelve al escritorio).
  if (moduloDesactivado('puntualidad')) redirect('/gestion');
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/puntualidad');

  const [asignaturas, profe] = await Promise.all([ensureSubjects(), getTeacherByEmail(user.email)]);
  const registradoPor = profe
    ? [profe.nombre, profe.apellido1].filter(Boolean).join(' ')
    : (user.nombre ?? user.email);

  return (
    <PaginaModulo
      modulo="puntualidad"
      ancho="estrecho"
      accion={
        canAccess(user, 'puntualidad') ? (
          <Link href="/gestion/puntualidad" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <LayoutDashboard aria-hidden /> Panel
          </Link>
        ) : undefined
      }
    >
      <h1 className="sr-only">Registrar un retraso</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Hora límite de entrada: <span className="font-medium tabular-nums">{CONFIGURACION.puntualidad.horaLimite}</span>.
      </p>
      <PuntualidadForm
        asignaturas={asignaturas
          .filter((a) => a.active)
          .map((a) => ({ id: a.id, nombre: a.nombre, abreviatura: a.abreviatura }))}
        registradoPor={registradoPor}
      />
    </PaginaModulo>
  );
}
