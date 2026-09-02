import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { setAmpa } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  const user = await requireModule('bancolibros');
  if (isGuardResponse(user)) return user;
  if (!puedeGestionarParticipantesBanco(user.role)) {
    return NextResponse.json({ error: 'Solo dirección/TIC pueden marcar quién es del AMPA' }, { status: 403 });
  }
  try {
    const { eduStudentIds, ampa } = z
      .object({ eduStudentIds: z.array(z.string().uuid()).min(1), ampa: z.boolean() })
      .parse(await request.json());
    await setAmpa(eduStudentIds, ampa);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
