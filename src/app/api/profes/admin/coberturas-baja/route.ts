import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { actualizarCoberturaBaja, borrarCoberturaBaja, crearCoberturaBaja, ErrorCoberturaBaja } from '@/lib/coberturas-baja-server';

export const dynamic = 'force-dynamic';

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha no válida');

const crearSchema = z.object({
  sustitutoId: z.string().uuid(),
  titularId: z.string().uuid(),
  desde: fecha.nullable().default(null),
  hasta: fecha.nullable().default(null),
  nota: z.string().trim().max(300).nullable().default(null),
});

const cambiarSchema = z.object({
  id: z.string().uuid(),
  activa: z.boolean().optional(),
  desde: fecha.nullable().optional(),
  hasta: fecha.nullable().optional(),
  nota: z.string().trim().max(300).nullable().optional(),
});

const borrarSchema = z.object({ id: z.string().uuid() });

function fallo(error: unknown) {
  const message =
    error instanceof ErrorCoberturaBaja
      ? error.message
      : error instanceof z.ZodError
        ? (error.issues[0]?.message ?? 'Datos no válidos')
        : 'No se ha podido guardar';
  if (!(error instanceof ErrorCoberturaBaja) && !(error instanceof z.ZodError)) {
    console.error('Coberturas por baja:', error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Apuntar a mano que alguien sustituye a otra persona. */
export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = crearSchema.parse(await request.json());
    const fila = await crearCoberturaBaja(datos);
    return NextResponse.json({ ok: true, id: fila.id });
  } catch (error) {
    return fallo(error);
  }
}

/** Encender o apagar, o cambiar las fechas de una cobertura por baja. */
export async function PATCH(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id, ...cambios } = cambiarSchema.parse(await request.json());
    const fila = await actualizarCoberturaBaja(id, cambios);
    if (!fila) return NextResponse.json({ error: 'Esa cobertura por baja ya no existe' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error);
  }
}

export async function DELETE(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = borrarSchema.parse(await request.json());
    await borrarCoberturaBaja(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error);
  }
}
