import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers } from '@/db/schema';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, MODULE_LABELS, ROLE_LABELS } from '@/lib/permissions';
import { appBaseUrl } from '@/lib/constants';
import { enviar } from '@/lib/email';
import { cookieSolicitud, correoSolicitudAcceso, DIAS_SOLICITUD, esSolicitable } from '@/lib/solicitud-acceso';

// «Solicitar acceso» desde el escritorio (docs/03-escritorio-admin.md): avisa por correo a los
// SuperTIC de que alguien quiere un módulo que no tiene. No da nada: lo da una persona, desde
// Usuarios y roles. Basta la sesión del claustro. Una cookie recuerda que ya se pidió, para que
// un doble toque o un recargar no manden dos correos.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.role) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await request.json().catch(() => null)) as { modulo?: unknown } | null;
  const modulo = typeof cuerpo?.modulo === 'string' ? cuerpo.modulo : '';
  if (!esSolicitable(modulo)) return NextResponse.json({ error: 'Ese módulo no se pide así' }, { status: 400 });
  if (canAccess(user, modulo)) return NextResponse.json({ error: 'Ya tienes acceso a este módulo' }, { status: 409 });

  const nombreCookie = cookieSolicitud(user.email, modulo);
  if (request.headers.get('cookie')?.split(/;\s*/).some((c) => c.startsWith(`${nombreCookie}=`))) {
    return NextResponse.json({ ok: true, yaPedida: true });
  }

  try {
    const destinatarios = (
      await db
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(and(eq(authUsers.role, 'supertic'), eq(authUsers.active, true)))
    ).map((u) => u.email);
    if (destinatarios.length === 0) {
      return NextResponse.json({ error: 'No hay a quién avisar ahora mismo: díselo a TIC en persona' }, { status: 503 });
    }
    const correo = correoSolicitudAcceso({
      nombre: user.nombre,
      email: user.email,
      rol: ROLE_LABELS[user.role],
      modulo: MODULE_LABELS[modulo],
      url: `${appBaseUrl()}/gestion/usuarios`,
    });
    // El Reply-To es quien lo pide: contestar al correo es hablar con esa persona.
    await enviar('general', { to: destinatarios, subject: correo.asunto, html: correo.html, replyTo: user.email });
  } catch (error) {
    console.error('Solicitud de acceso:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido enviar. Inténtalo de nuevo en un rato' }, { status: 500 });
  }

  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(nombreCookie, '1', { path: '/', maxAge: DIAS_SOLICITUD * 24 * 3600, sameSite: 'lax', httpOnly: true });
  return respuesta;
}
