import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { borrarConfigFtp, getConfigFtpPublica, guardarConfigFtp } from '@/lib/autoasm-entregas';

export const dynamic = 'force-dynamic';

const config = z.object({
  protocolo: z.enum(['ftps', 'ftp', 'sftp']),
  host: z.string().min(1).max(255),
  puerto: z.number().int().min(1).max(65535).nullable().optional(),
  usuario: z.string().min(1).max(255),
  // Vacía = "no la cambies": así se puede editar la ruta sin volver a escribirla.
  password: z.string().max(255).optional(),
  ruta: z.string().max(500),
  notas: z.string().max(500).nullable().optional(),
});

async function usuario() {
  const user = await getSessionUser();
  return user && canAccess(user, 'autoasm') ? user : null;
}

/** La configuración del FTP SIN la contraseña: nunca sale de Neon. */
export async function GET() {
  if (!(await usuario())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ config: await getConfigFtpPublica() });
  } catch (error) {
    console.error('AUTOASM: error leyendo el FTP:', error);
    return NextResponse.json({ error: 'Error leyendo la configuración' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const datos = config.parse(await request.json());
    await guardarConfigFtp({ ...datos, quien: user.email });
    return NextResponse.json({ config: await getConfigFtpPublica() });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
    console.error('AUTOASM: error guardando el FTP:', error);
    const mensaje = error instanceof Error && /contraseña/.test(error.message) ? error.message : 'Error guardando la configuración';
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await usuario())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  await borrarConfigFtp();
  return NextResponse.json({ ok: true });
}
