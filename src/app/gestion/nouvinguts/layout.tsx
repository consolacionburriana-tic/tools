import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function NouvingutsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'nouvinguts')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="nouvinguts"
      ancho="ancho"
      // «Apuntar» abre el diálogo de la lista (`?apuntar=1`), también desde una ficha.
      accion={
        <Link href="/gestion/nouvinguts?apuntar=1" className={buttonVariants({ size: 'sm' })}>
          <UserPlus aria-hidden /> Apuntar
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
