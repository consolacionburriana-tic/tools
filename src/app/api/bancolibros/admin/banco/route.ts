import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { setBanco } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  const user = await requireModule('bancolibros');
  if (isGuardResponse(user)) return user;
  if (!puedeGestionarParticipantesBanco(user.role)) {
    return NextResponse.json({ error: 'Solo jefatura, dirección o TIC pueden marcar quién participa en el banco' }, { status: 403 });
  }
  try {
    const { eduStudentId, banco } = z
      .object({ eduStudentId: z.string().uuid(), banco: z.boolean() })
      .parse(await request.json());
    await setBanco(eduStudentId, banco);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
