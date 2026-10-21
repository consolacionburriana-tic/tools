import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function SalidasLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'salidas')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="salidas"
      ancho="normal"
      accion={
        <Link href="/gestion/salidas/nueva" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Nueva salida
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
