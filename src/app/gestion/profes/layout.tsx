import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'profes')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo modulo="profes" ancho="normal">
      {children}
    </PaginaModulo>
  );
}
