import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { nuevaContrasenaSchema } from '@/lib/cuentas';
import { nuevaContrasena } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';

// Contraseña nueva para una cuenta. Vuelve en la respuesta una vez y no se guarda.
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof nuevaContrasenaSchema>;
  try {
    datos = nuevaContrasenaSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    const r = await nuevaContrasena(buzonAdmin(user.email), datos.id, datos.contrasena, datos.cambiarAlEntrar, user.email);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 409 });
  } catch (error) {
    console.error('Cuentas: error cambiando la contraseña:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error cambiando la contraseña' }, { status: 500 });
  }
}
