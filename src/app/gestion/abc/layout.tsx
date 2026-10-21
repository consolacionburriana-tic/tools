import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, GraduationCap, LayoutDashboard, Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Las tres áreas del módulo. «Registrar» lleva al formulario rápido (/registro-abc), el que
// abre el profesorado desde el iPad.
const SECCIONES = [
  { href: '/gestion/abc', etiqueta: 'Panel', icono: <LayoutDashboard /> },
  { href: '/gestion/abc/registros', etiqueta: 'Registros', icono: <FileText /> },
  { href: '/gestion/abc/alumnos', etiqueta: 'Alumnado', icono: <GraduationCap /> },
];

export default async function AbcLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'abc')) redirect('/gestion/sin-acceso');

  return (
    <PaginaModulo
      modulo="abc"
      ancho="normal"
      secciones={SECCIONES}
      accion={
        <Link href="/registro-abc" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Registrar
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
