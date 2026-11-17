import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeVerMisSustituciones } from '@/lib/sustituciones';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// «Mis sustituciones» (docs/32, decisión 16): hecho para todo el claustro, abierto de momento solo a
// quien tiene el módulo (`misSustitucionesParaTodos`). Fuera del layout del módulo: sin secciones.
export default async function MisSustitucionesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/gestion/mis-sustituciones');
  if (!puedeVerMisSustituciones(user)) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo modulo="sustituciones" titulo="Mis sustituciones" ancho="estrecho">
      {children}
    </PaginaModulo>
  );
}
