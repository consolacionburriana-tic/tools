import { NextResponse } from 'next/server';
import { cursoLabel, maskName } from '@/lib/licencias';
import {
  getCatalog,
  getCurrentCampaign,
  getOrderForStudent,
  getStudentById,
  upsertOrder,
} from '@/lib/licencias-server';
import { notifyGestores, sendFamilyConfirmation } from '@/lib/licencias-email';

// Precarga: ¿este alumno ya tiene pedido en la campaña actual?
export async function GET(request: Request) {
  try {
    const studentId = new URL(request.url).searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ error: 'Falta studentId' }, { status: 400 });
    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ order: null });
    const existing = await getOrderForStudent(campaign.id, studentId);
    if (!existing) return NextResponse.json({ order: null });
    return NextResponse.json({
      order: {
        curso: existing.order.curso,
        email: existing.order.email,
        total: Number(existing.order.totalPrice),
      },
      cods: existing.cods,
    });
  } catch (error) {
    console.error('Error en orders GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { studentId, curso, email, cods } = (await request.json()) as {
      studentId: string;
      curso: string;
      email?: string;
      cods: string[];
    };
    if (!studentId || !curso) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }
    const student = await getStudentById(studentId);
    if (!student) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

    const cleanEmail = email?.trim() ?? '';
    const result = await upsertOrder(student, curso, cleanEmail, Array.isArray(cods) ? cods : []);

    // Datos para los correos (precios de confianza desde el catálogo)
    const catalog = await getCatalog(student, curso);
    const byCod = new Map(catalog.map((b) => [b.cod, b]));
    const items = (cods ?? [])
      .filter((c) => byCod.has(c))
      .map((c) => ({ asignatura: byCod.get(c)!.asignatura, precio: byCod.get(c)!.precio }));

    const origin = new URL(request.url).origin;
    const emailData = {
      alumno: `${maskName(student.nombre)} ${student.apellidos}`,
      curso: cursoLabel(curso),
      email: cleanEmail,
      items,
      total: result.total,
      editUrl: `${origin}/licencias`,
    };
    const [familyStatus] = await Promise.all([
      cleanEmail ? sendFamilyConfirmation(emailData) : Promise.resolve('skipped' as const),
      notifyGestores(emailData),
    ]);

    return NextResponse.json({
      ok: true,
      editToken: result.editToken,
      total: result.total,
      itemCount: result.itemCount,
      emailStatus: familyStatus,
    });
  } catch (error) {
    console.error('Error en orders POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
