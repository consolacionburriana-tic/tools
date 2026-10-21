import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, LayoutDashboard, ListChecks, Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, vePuntualidadCompleta } from '@/lib/permissions';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Las tres áreas que usa todo el que entra. Las asignaturas son ajustes del módulo: se llega
// desde el panel (solo quien ve todo el centro) y se vuelve con «‹ Panel».
const SECCIONES = [
  { href: '/gestion/puntualidad', etiqueta: 'Panel', icono: <LayoutDashboard /> },
  { href: '/gestion/puntualidad/registros', etiqueta: 'Retrasos', icono: <ClipboardList /> },
  { href: '/gestion/puntualidad/consecuencias', etiqueta: 'Consecuencias', icono: <ListChecks /> },
];

export default async function PuntualidadLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'puntualidad')) redirect('/gestion/sin-acceso');

  // Un tutor ve el panel, pero solo con el alumnado de sus tutorías (el filtro real está
  // en las queries; aquí solo se avisa de que lo que ve es lo suyo).
  const completo = vePuntualidadCompleta(user.role);

  return (
    <PaginaModulo
      modulo="puntualidad"
      ancho="normal"
      secciones={SECCIONES}
      aviso={completo ? undefined : 'Ves solo el alumnado de las clases que tutorizas.'}
      accion={
        <Link href="/puntualidad" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> Registrar
        </Link>
      }
    >
      {children}
    </PaginaModulo>
  );
}
