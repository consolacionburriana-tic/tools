import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function CalendariosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'calendarios')) redirect('/gestion/sin-acceso');

  // Sin acción en la cabecera: escanear el dominio va con su progreso dentro de la página.
  return (
    <PaginaModulo modulo="calendarios" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
