import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, CalendarClock, Grid3x3, History, Plus, UserRoundMinus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Sustituciones (docs/32): Jefatura, Dirección, Secretaría y TIC. Las secciones son las cinco áreas
// hermanas; «Nueva ausencia» es la acción principal y Ajustes de los correos, un enlace en la página.
export default async function SustitucionesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'sustituciones')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo
      modulo="sustituciones"
      ancho="normal"
      secciones={[
        { href: '/gestion/sustituciones', etiqueta: 'Hoy', icono: <CalendarClock aria-hidden /> },
        { href: '/gestion/sustituciones/disponibilidad', etiqueta: 'Disponibilidad', icono: <Grid3x3 aria-hidden /> },
        { href: '/gestion/sustituciones/bajas', etiqueta: 'Bajas', icono: <UserRoundMinus aria-hidden /> },
        { href: '/gestion/sustituciones/historial', etiqueta: 'Historial', icono: <History aria-hidden /> },
        { href: '/gestion/sustituciones/numeros', etiqueta: 'Números', icono: <BarChart3 aria-hidden /> },
      ]}
      accion={
        <Link href="/gestion/sustituciones/nueva" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Nueva ausencia
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
