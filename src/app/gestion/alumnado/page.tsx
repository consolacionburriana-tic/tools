export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { AlumnadoPanel, ResumenAlumnado } from '@/components/alumnado/alumnado-panel';
import { alcanceAlumnado, fichaAlumno, listaAlumnado, puedeConAlumno } from '@/lib/alumnado-server';

export const metadata = { title: 'Alumnado · Gestión' };

/**
 * `?alumno=<id>` se resuelve **en el servidor**: quien abra un enlace a una ficha (o
 * recargue la página) recibe el HTML con la ficha dentro, sin parpadeo ni petición extra.
 * El resto de fichas las pide el cliente al tocarlas, que para eso está la caché del panel.
 */
export default async function AlumnadoPage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const [{ alumno: pedido }, alcance] = await Promise.all([searchParams, alcanceAlumnado(user)]);
  const { alumnos, clases } = await listaAlumnado(alcance);

  // El alcance se comprueba también aquí: un enlace a un alumno de otra clase no puede
  // colar su ficha en el HTML por venir en la URL.
  const candidata = pedido && /^[0-9a-f-]{36}$/i.test(pedido) ? await fichaAlumno(pedido) : null;
  const fichaInicial = candidata && puedeConAlumno(alcance, candidata) ? candidata : null;

  return (
    <div className="space-y-3">
      <ResumenAlumnado total={alumnos.length} clases={clases.length} />
      <AlumnadoPanel
        alumnos={alumnos}
        clases={clases}
        soloMisClases={alcance !== null}
        fichaInicial={fichaInicial}
      />
    </div>
  );
}
