export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { AlumnadoPanel, ResumenAlumnado } from '@/components/alumnado/alumnado-panel';
import {
  alcanceAlumnado,
  alcanceProteccion,
  fichaAlumno,
  fichaVisible,
  listaAlumnado,
  puedeConAlumno,
} from '@/lib/alumnado-server';
import {
  canAccess,
  puedeGestionarMateriales,
  puedeGestionarParticipantesBanco,
  veBecasMateriales,
} from '@/lib/permissions';

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
  // El alcance de la protección de datos es más estrecho que el de la pantalla: dirección y
  // demás la ven entera, un tutor solo la de su tutoría (ver `alcanceProteccion`).
  const pd = alcanceProteccion(user, alcance.propias);
  const veBecas = veBecasMateriales(user.role);
  const { alumnos, clases, materiales } = await listaAlumnado(alcance.clases, undefined, pd, veBecas);

  // El alcance se comprueba también aquí: un enlace a un alumno de otra etapa no puede
  // colar su ficha en el HTML por venir en la URL.
  const candidata = pedido && /^[0-9a-f-]{36}$/i.test(pedido) ? await fichaAlumno(pedido) : null;
  const fichaInicial =
    candidata && puedeConAlumno(alcance.clases, candidata) ? fichaVisible(candidata, user, pd) : null;

  return (
    <div className="space-y-3">
      <ResumenAlumnado total={alumnos.length} clases={clases.length} etapas={alcance.etapas} />
      <AlumnadoPanel
        alumnos={alumnos}
        clases={clases}
        etapas={alcance.etapas}
        propias={alcance.propias}
        fichaInicial={fichaInicial}
        puedeEditarProteccion={pd.edita}
        puedeParticipacion={canAccess(user, 'bancolibros') && puedeGestionarParticipantesBanco(user.role)}
        materiales={materiales}
        puedeGestionarMateriales={puedeGestionarMateriales(user.role)}
        veBecas={veBecas}
      />
    </div>
  );
}
