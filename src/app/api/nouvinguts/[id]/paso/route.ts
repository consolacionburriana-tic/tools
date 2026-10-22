import { after, NextResponse } from 'next/server';
import { accionPasoSchema } from '@/lib/nouvinguts';
import { accionPaso, avisarCambio } from '@/lib/nouvinguts-server';
import { puedeEditarProteccionDatos, puedeGestionarMateriales, puedeGestionarParticipantesBanco, puedeGestionarServicios } from '@/lib/permissions';
import { conFicha, fallo, firma, idValido, isGuardResponse, leer, requireModule } from '../../respuesta';

export const dynamic = 'force-dynamic';

/**
 * Resolver un paso desde la ficha. Lo que vive en otro módulo (protección de datos, banco,
 * AMPA, materiales) exige además el permiso de ese dato, el mismo que en su pantalla.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  const accion = await leer(request, accionPasoSchema);
  if (accion instanceof NextResponse) return accion;
  try {
    const { antes } = await accionPaso(id, accion, firma(guard), {
      proteccion: puedeEditarProteccionDatos(guard.role),
      participantes: puedeGestionarParticipantesBanco(guard.role),
      materiales: puedeGestionarMateriales(guard.role),
      servicios: puedeGestionarServicios(guard.role),
    });
    // Si con esto ha terminado una parte (secretaría o TIC) o ya está listo, avisa a quien toque.
    after(() => avisarCambio(id, antes, firma(guard)));
    return await conFicha(id, guard);
  } catch (error) {
    return fallo(error, `paso ${accion.paso}`);
  }
}
