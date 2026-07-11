import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { setBanco } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
