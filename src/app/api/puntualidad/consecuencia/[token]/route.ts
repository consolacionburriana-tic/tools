import { NextResponse } from 'next/server';
import { z } from 'zod';
import { consecuenciaPorToken, updateConsecuencia } from '@/lib/puntualidad-server';
import { getSessionUser } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

// Endpoint del enlace de un clic del correo al tutor: SIN login a propósito (el tutor lo
// abre desde el móvil y fija el día en dos toques). El token es la credencial: identifica
// una única consecuencia, caduca a los 60 días y solo permite tocar esa fila. Si además
// hay sesión, se guarda quién fue; si no, queda como "desde el enlace del aviso".
const schema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notas: z.string().max(1000).nullable().optional(),
  cumplida: z.boolean().optional(),
  avisadaEducamos: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const consecuencia = await consecuenciaPorToken(token);
    if (!consecuencia) {
      return NextResponse.json({ error: 'Este enlace ya no es válido' }, { status: 404 });
    }
    const cambios = schema.parse(await request.json());
    const user = await getSessionUser();
    await updateConsecuencia(consecuencia.id, cambios, user?.email ?? 'enlace-aviso');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
