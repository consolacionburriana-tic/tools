import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function CuentasLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'cuentas') && !canAccess(user, 'cuentas-ver')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="cuentas"
      ancho="ancho"
      // Con «cuentas-ver» se ve todo, pero la pantalla esconde lo que cambia algo en Google.
      aviso={canAccess(user, 'cuentas') ? undefined : 'Lo ves para consultar: los cambios los hace TIC.'}
    >
      {children}
    </PaginaModulo>
  );
}
