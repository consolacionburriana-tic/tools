import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { setOrderPaid } from '@/lib/licencias-server';


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { paid } = (await request.json()) as { paid: boolean };
  await setOrderPaid(id, paid);
  return NextResponse.json({ ok: true });
}
