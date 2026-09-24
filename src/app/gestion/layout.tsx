import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { LanzadorTareas } from '@/components/tareas/lanzador';

// Envuelve todo /gestion solo para poner el botón de apuntar fallitos (abajo a la derecha)
// a quien le toque. Cada sección sigue teniendo su propio layout con su cabecera y su guard.
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const gestiona = canAccess(user, 'tareas');
  const reporta = gestiona || canAccess(user, 'tareas-reportar');
  return (
    <>
      {children}
      {reporta && <LanzadorTareas gestiona={gestiona} />}
    </>
  );
}
