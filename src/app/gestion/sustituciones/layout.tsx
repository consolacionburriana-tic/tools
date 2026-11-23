import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Bus, CalendarDays, Grid3x3, History, Plus, UserRoundMinus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Sustituciones (docs/32): Jefatura, Dirección, Secretaría y TIC. Lo principal es la semana (el
// calendario); «Apuntar» abre su panel desde cualquier sección. Ancho: el calendario necesita sitio.
export default async function SustitucionesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'sustituciones')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo
      modulo="sustituciones"
      ancho="ancho"
      secciones={[
        { href: '/gestion/sustituciones', etiqueta: 'Semana', icono: <CalendarDays aria-hidden /> },
        { href: '/gestion/sustituciones/salidas', etiqueta: 'Salidas', icono: <Bus aria-hidden /> },
        { href: '/gestion/sustituciones/bajas', etiqueta: 'Bajas', icono: <UserRoundMinus aria-hidden /> },
        { href: '/gestion/sustituciones/disponibilidad', etiqueta: 'Disponibilidad', icono: <Grid3x3 aria-hidden /> },
        { href: '/gestion/sustituciones/historial', etiqueta: 'Historial', icono: <History aria-hidden /> },
        { href: '/gestion/sustituciones/numeros', etiqueta: 'Números', icono: <BarChart3 aria-hidden /> },
      ]}
      accion={
        <Link href="/gestion/sustituciones?nueva=1" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Apuntar
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
