import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { ARCHIVOS_ASM } from '@/lib/autoasm';
import { fijarAjuste, getAjustes, soltarAjuste } from '@/lib/autoasm-ajustes';

export const dynamic = 'force-dynamic';

// Lo escrito a mano en los ficheros de ASM. Vive en Neon porque su razón de ser es
// sobrevivir al siguiente «traer del centro» (que rehace las filas de quien está en
// `edu_*`) y al cambio de dispositivo.

const cuerpo = z.object({
  archivo: z.enum(ARCHIVOS_ASM),
  clave: z.string().trim().min(1).max(200),
  campo: z.string().trim().min(1).max(60),
  valor: z.string().max(300).default(''),
});

export async function GET() {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await getAjustes());
  } catch (error) {
    console.error('AUTOASM: error leyendo los ajustes:', error);
    return NextResponse.json({ error: 'Error leyendo los ajustes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const datos = cuerpo.parse(await request.json());
    const user = await getSessionUser();
    const r = await fijarAjuste({ ...datos, quien: user?.email ?? null });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

/** Soltar un ajuste: ese campo vuelve a ser lo que diga la BBDD central. */
export async function DELETE(request: Request) {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const datos = cuerpo.omit({ valor: true }).parse(await request.json());
    const r = await soltarAjuste(datos);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
