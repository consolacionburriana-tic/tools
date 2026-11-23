import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { hoyEnEspana } from '@/lib/oratorios';
import { CONFIGURACION } from '@/lib/configuracion';
import { TIPOS_PLANTILLA, type Plantillas } from '@/lib/sustituciones';
import { getPlantillas, nombreDe } from '@/lib/sustituciones-server';
import { AjustesCorreos } from '@/components/sustituciones/ajustes';
import { quiereAvisoConfirmacion } from '@/lib/sustituciones-confirmacion-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Correos y avisos · Sustituciones' };

export default async function AjustesCorreosPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const [todo, nombre, aviso] = await Promise.all([getPlantillas(), user.nombre ? Promise.resolve(user.nombre) : nombreDe(user.email), quiereAvisoConfirmacion(user.emulando?.email ?? user.email)]);
  const plantillas = Object.fromEntries(TIPOS_PLANTILLA.map((t) => [t, todo[t]])) as Plantillas;
  const m = todo._meta;
  const actualizado = m.updatedAt
    ? `${m.updatedAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: CONFIGURACION.calendario.zonaHoraria })}${m.updatedByEmail ? ` · ${m.updatedByEmail}` : ''}`
    : null;
  return <AjustesCorreos inicial={plantillas} quien={nombre} hoy={hoyEnEspana()} actualizado={actualizado} avisoConfirmacion={aviso} />;
}
