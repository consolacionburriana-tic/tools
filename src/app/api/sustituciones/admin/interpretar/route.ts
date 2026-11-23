// ⌘K: una sustitución escrita como se dice → lo entendido, para abrir la propuesta ya rellenada. No guarda nada.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { hoyEnEspana } from '@/lib/oratorios';
import { interpretarConIA } from '@/lib/sustituciones-interpretar-server';
import { profesParaPaleta } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  const p = z.object({ texto: z.string().trim().min(2).max(400) }).safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Escribe quién falta y cuándo' }, { status: 400 });
  return NextResponse.json(await interpretarConIA(p.data.texto.replace(/^\s*s\s+/i, ''), hoyEnEspana(), await profesParaPaleta()));
}
