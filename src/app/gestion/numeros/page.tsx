export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeHacerFotosNumeros } from '@/lib/permissions';
import { numerosPara } from '@/lib/numeros-server';
import { COOKIE_PREFERENCIAS, leerPreferencias } from '@/lib/numeros';
import { NumerosPanel } from '@/components/numeros/numeros-panel';

export const metadata = { title: 'Números del cole · Gestión' };

// Ficha: docs/24-numeros.md. Los recuentos se calculan al abrir, ya recortados para quien
// mira (sus clases y sus pestañas); las preferencias («solo lo básico», pestaña, nivel)
// vienen de una cookie para que la página salga como la dejaste, sin parpadeo.
export default async function NumerosPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const [{ datos, vista }, galletas] = await Promise.all([numerosPara(user), cookies()]);

  return (
    <NumerosPanel
      datos={datos}
      permisos={vista.permisos}
      etapasPropias={vista.clases === null ? [] : vista.etapas}
      preferencias={leerPreferencias(galletas.get(COOKIE_PREFERENCIAS)?.value)}
      puedeFoto={puedeHacerFotosNumeros(user.role)}
    />
  );
}
