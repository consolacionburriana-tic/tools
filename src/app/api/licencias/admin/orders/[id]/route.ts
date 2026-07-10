import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { deleteOrderHard, getOrderDetail, updateOrderItemsAdmin } from '@/lib/licencias-server';


export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { cods, email } = (await request.json()) as { cods: string[]; email?: string };
  if (!Array.isArray(cods)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  try {
    await updateOrderItemsAdmin(id, cods, email);
    const detail = await getOrderDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error editando pedido:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  await deleteOrderHard(id);
  return NextResponse.json({ ok: true });
}
