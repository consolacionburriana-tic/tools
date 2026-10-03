import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { LanzadorTareas } from '@/components/tareas/lanzador';
import { AvisoTableros } from '@/components/tableros/aviso-global';

// Envuelve todo /gestion para poner dos cosas flotantes a quien le toquen: el botón de apuntar
// fallitos (abajo a la derecha) y el aviso de tareas vencidas de los Tableros (abajo a la
// izquierda). Cada sección sigue teniendo su propio layout con su cabecera y su guard.
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const gestiona = canAccess(user, 'tareas');
  const reporta = gestiona || canAccess(user, 'tareas-reportar');
  return (
    <>
      {children}
      {reporta && <LanzadorTareas gestiona={gestiona} />}
      {canAccess(user, 'tableros') && <AvisoTableros />}
    </>
  );
}
