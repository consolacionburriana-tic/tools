import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import {
  borrarAnotacionSchema,
  crearAnotacionSchema,
  editarAnotacionSchema,
} from '@/lib/mihorario-anotaciones';
import { borrarAnotacion, crearAnotacion, editarAnotacion, ErrorAnotacion, getProfePorEmail } from '@/lib/mihorario-server';

export const dynamic = 'force-dynamic';

/**
 * Anotaciones propias en «Mi horario»: cada persona escribe SOLO en su horario, y el profe sale
 * del correo del login, nunca del cuerpo de la petición. Por eso no hay un `profeId` en el
 * payload: no hay forma de pedir que se escriba en el de otro.
 */
async function conProfe<T>(req: Request, schema: ZodType<T>, accion: (profeId: string, datos: T) => Promise<unknown>) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canAccess(user, 'mi-horario')) return NextResponse.json({ error: 'Sin acceso a Mi horario' }, { status: 403 });
  const profe = await getProfePorEmail(user.email);
  if (!profe) {
    return NextResponse.json({ error: `Tu correo (${user.email}) no está enlazado a ningún profesor. Habla con TIC.` }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos', detalle: parsed.error.flatten() }, { status: 400 });

  try {
    return NextResponse.json((await accion(profe.id, parsed.data)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ErrorAnotacion) return NextResponse.json({ error: e.message }, { status: e.estado });
    console.error('[mi-horario/anotaciones]', e instanceof Error ? e.message : 'error desconocido');
    return NextResponse.json({ error: 'No se pudo guardar. Prueba otra vez.' }, { status: 500 });
  }
}

export const POST = (req: Request) => conProfe(req, crearAnotacionSchema, crearAnotacion);
export const PATCH = (req: Request) => conProfe(req, editarAnotacionSchema, editarAnotacion);
export const DELETE = (req: Request) => conProfe(req, borrarAnotacionSchema, (profeId, d) => borrarAnotacion(profeId, d.sesionId));
