import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// El alta va en la propia página (columna de la izquierda): la cabecera no lleva acción.
export default async function TareasLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'tareas')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo modulo="tareas" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
