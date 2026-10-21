import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// La cabecera común no sale al imprimir (`print:hidden`), así que la ficha de valoración
// sigue saliendo en papel sin ella.
export default async function BancoLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'bancolibros')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo modulo="bancolibros" ancho="normal">
      {children}
    </PaginaModulo>
  );
}
