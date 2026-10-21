import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Upload } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, puedeEditarHorarios } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

export default async function HorariosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'horarios')) redirect('/gestion/sin-acceso');
  const puedeEditar = puedeEditarHorarios(user.role);

  return (
    <PaginaModulo
      modulo="horarios"
      ancho="ancho"
      // «Importar» solo para quien puede escribir horarios; el resto solo los consulta.
      accion={
        puedeEditar ? (
          <Link href="/gestion/horarios/importar" className={buttonVariants({ size: 'sm' })}>
            <Upload aria-hidden />
            <span className="sr-only sm:not-sr-only">Importar</span>
          </Link>
        ) : undefined
      }
    >
      {children}
    </PaginaModulo>
  );
}
