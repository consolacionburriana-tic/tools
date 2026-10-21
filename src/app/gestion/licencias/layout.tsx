import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Licencias es un módulo índice: la portada es el panel con todas sus pantallas, y cada una
// vuelve a él con su «‹ Panel de licencias». Ancho de tabla porque Pedidos y Envío de
// licencias son hojas de cálculo; los formularios se estrechan dentro de su página.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'licencias')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo modulo="licencias" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
