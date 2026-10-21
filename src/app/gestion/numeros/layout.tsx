import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// La cabecera común no sale al imprimir (`print:hidden`) y el contenido se queda sin márgenes,
// así que la hoja impresa del informe sigue saliendo igual.
export default async function NumerosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'numeros')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo modulo="numeros" ancho="ancho">
      {children}
    </PaginaModulo>
  );
}
