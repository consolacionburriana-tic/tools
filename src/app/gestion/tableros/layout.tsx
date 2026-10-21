import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// El módulo deja entrar a todo el claustro; lo que cada uno ve dentro lo decide ser miembro de
// cada equipo (docs/27-tableros.md), no el rol. Ancho completo: el lienzo de un tablero
// necesita toda la pantalla (la portada se centra ella sola).
export default async function TablerosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'tableros')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="tableros"
      ancho="completo"
      // «Nuevo equipo» abre el diálogo de la portada (`?nuevo=1`), también desde un tablero.
      accion={
        <Link href="/gestion/tableros?nuevo=1" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Nuevo equipo
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
