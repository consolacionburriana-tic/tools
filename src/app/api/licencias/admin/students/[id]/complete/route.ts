import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { setStudentManualCompleted } from '@/lib/licencias-server';

const isAdmin = () => hasModule('licencias');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { completed, reason } = (await request.json()) as { completed: boolean; reason?: string };
  await setStudentManualCompleted(id, completed, reason);
  return NextResponse.json({ ok: true });
}
