import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { SelectorTema } from '@/components/home/selector-tema';

// El escaparate de las piezas comunes (docs/diseno.md). Lo ve quien lleva los ajustes del
// colegio: es una herramienta para construir pantallas, no para el día a día.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'ajustes')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo modulo="diseno" ancho="normal" accion={<SelectorTema />}>
      {children}
    </PaginaModulo>
  );
}
