export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { getAlumnosSeguimiento, getTeacherFromSession } from '@/lib/abc-server';
import { RegistroForm } from '@/components/registro-abc/registro-form';

export const metadata = {
  title: 'Registro ABC · Consolación',
  description: 'Registro de conductas · Análisis A-B-C',
};

// Detrás del login (cualquier persona del claustro): el profesor sale de la sesión.
export default async function RegistroAbcPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/registro-abc');

  const [alumnos, profe] = await Promise.all([
    getAlumnosSeguimiento(),
    getTeacherFromSession(user.email),
  ]);
  const registradoPor = profe
    ? [profe.nombre, profe.apellido1, profe.apellido2].filter(Boolean).join(' ')
    : (user.nombre ?? user.email);

  // El formulario rápido con la cabecera común del módulo; el enlace al panel solo sale a
  // quien puede abrirlo (registrar lo puede hacer cualquier profe).
  return (
    <PaginaModulo
      modulo="abc"
      ancho="estrecho"
      accion={
        canAccess(user, 'abc') ? (
          <Link href="/gestion/abc" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <LayoutDashboard aria-hidden /> Panel
          </Link>
        ) : undefined
      }
    >
      <h1 className="sr-only">Registrar una conducta</h1>
      <RegistroForm alumnos={alumnos} registradoPor={registradoPor} />
    </PaginaModulo>
  );
}
