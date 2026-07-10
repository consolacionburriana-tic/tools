import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { setOrderArchived } from '@/lib/licencias-server';


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { archived, reason } = (await request.json()) as { archived: boolean; reason?: string };
  await setOrderArchived(id, archived, reason);
  return NextResponse.json({ ok: true });
}
