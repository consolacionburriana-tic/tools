import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function OratoriosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  // `oratorios-ver` deja pasar; la página decide si hay acceso común encendido.
  if (!canAccess(user, 'oratorios') && !canAccess(user, 'oratorios-ver')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo modulo="oratorios" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
