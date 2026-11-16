import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Armchair, Bot, DoorOpen, Plus, Projector, Wifi, Wrench } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { resumenInventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// Inventario y aulas (docs/33-inventario.md): seis áreas hermanas arriba, cada una su ruta.
const SECCIONES = [
  { href: '/gestion/inventario', etiqueta: 'Aulas', icono: <DoorOpen /> },
  { href: '/gestion/inventario/audiovisual', etiqueta: 'Audiovisual', icono: <Projector /> },
  { href: '/gestion/inventario/mobiliario', etiqueta: 'Mesas y sillas', icono: <Armchair /> },
  { href: '/gestion/inventario/antenas', etiqueta: 'Antenas', icono: <Wifi /> },
  { href: '/gestion/inventario/robotica', etiqueta: 'Robótica', icono: <Bot /> },
  { href: '/gestion/inventario/arreglos', etiqueta: 'Arreglos', icono: <Wrench /> },
];

export default async function InventarioLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'inventario')) redirect('/gestion/sin-acceso');
  const resumen = await resumenInventario().catch(() => null);

  return (
    <PaginaModulo
      modulo="inventario"
      ancho="ancho"
      secciones={SECCIONES}
      accion={
        <Link href="/gestion/inventario/arreglos?apuntar=1" className={buttonVariants({ size: 'sm' })}>
          <Plus aria-hidden /> <span className="sr-only sm:not-sr-only">Apuntar arreglo</span>
        </Link>
      }
      aviso={
        resumen?.ajustarCurso ? (
          <>
            Empieza el curso {resumen.ajustarCurso}: cambia los carteles de las puertas y{' '}
            <Link href={`/gestion/inventario/clases?curso=${resumen.ajustarCurso}`} className="font-semibold underline underline-offset-4">
              ajusta qué clase va en cada aula
            </Link>
          </>
        ) : null
      }
    >
      {children}
    </PaginaModulo>
  );
}
