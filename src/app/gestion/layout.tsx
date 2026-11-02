import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { MODULOS_FALLO } from '@/lib/tareas';
import { LanzadorTareas } from '@/components/tareas/lanzador';
import { AvisoTableros } from '@/components/tableros/aviso-global';

// Envuelve todo /gestion para poner dos cosas flotantes a quien le toquen: el botón de apuntar
// fallitos (abajo a la derecha) y el aviso de tareas vencidas de los Tableros (abajo a la
// izquierda). Cada sección sigue teniendo su propio layout con su cabecera y su guard.
// El botón de fallitos lo lleva todo el claustro: TIC con su tablero y el resto solo «recogiendo».
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const gestiona = canAccess(user, 'tareas');
  const reporta = gestiona || canAccess(user, 'tareas-reportar');
  // Quien solo reporta elige entre los módulos que él mismo ve (no tiene sentido «AUTOASM» para un profe).
  const modulosFallo = MODULOS_FALLO.filter((m) => gestiona || canAccess(user, m));
  // Dirección, secretaría y orientación ya veían el estado de lo suyo; el resto solo recoge.
  const verLoSuyo = !gestiona && !!user?.role && ['direccion', 'secretaria', 'orientacion', 'comunicacion'].includes(user.role);
  return (
    <>
      {children}
      {reporta && <LanzadorTareas gestiona={gestiona} verLoSuyo={verLoSuyo} modulosFallo={modulosFallo} />}
      {canAccess(user, 'tableros') && <AvisoTableros />}
    </>
  );
}
