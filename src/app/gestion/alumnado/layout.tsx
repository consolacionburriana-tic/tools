import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function AlumnadoLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'alumnado')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo modulo="alumnado" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
