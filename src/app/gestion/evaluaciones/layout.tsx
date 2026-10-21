import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function EvaluacionesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'evaluaciones')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="evaluaciones"
      ancho="normal"
      accion={
        <Link href="/gestion/evaluaciones/nueva" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Nueva
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
