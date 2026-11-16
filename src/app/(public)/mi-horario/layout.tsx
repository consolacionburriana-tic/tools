import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { Paleta } from '@/components/paleta/paleta';
import { getSessionUser } from '@/lib/auth-guards';

// La cabecera común de «Mi horario». Los guardas (sesión y permiso) van en la página, que
// es la que sabe a dónde volver tras iniciar sesión.
export default async function MiHorarioLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <>
      <PaginaModulo modulo="mi-horario" ancho="normal">
        {children}
      </PaginaModulo>
      {user && <Paleta />}
    </>
  );
}
