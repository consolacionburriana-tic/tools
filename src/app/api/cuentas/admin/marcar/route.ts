import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { marcarSchema } from '@/lib/cuentas';
import { marcarCuenta } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

// Marca (o desmarca) una cuenta sin nadie de Educamos como «se queda».
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof marcarSchema>;
  try {
    datos = marcarSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    await marcarCuenta(datos.googleId, datos.tipo, datos.nota || null, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error marcando' }, { status: 409 });
  }
}
