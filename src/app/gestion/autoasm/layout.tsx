import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'autoasm')) redirect('/gestion/sin-acceso');
  // Sin acción en la cabecera: el ZIP sale del borrador de este navegador, en el paso 4.
  return (
    <PaginaModulo modulo="autoasm" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
