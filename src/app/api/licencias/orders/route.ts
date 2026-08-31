import { NextResponse } from 'next/server';
import { z } from 'zod';
import { campaignAbierta, cursoLabel } from '@/lib/licencias';
import { maskAlumno } from '@/lib/familias';
import {
  getCatalog,
  getCurrentCampaign,
  getOrderForStudent,
  getStudentById,
  identifyStudentsByFamily,
  upsertOrder,
} from '@/lib/licencias-server';
import { notifyGestores, sendFamilyConfirmation } from '@/lib/licencias-email';

// Precarga: ¿este alumno ya tiene pedido en la campaña actual? Revalidamos SIEMPRE que
// el alumno pertenece al identificador (flujo público sin sesión, nunca fiarse del id).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const identificador = url.searchParams.get('identificador');
    if (!studentId || !identificador?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ order: null });
    const candidatos = await identifyStudentsByFamily(campaign.id, identificador);
    if (!candidatos.some((c) => c.id === studentId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const existing = await getOrderForStudent(campaign.id, studentId);
    if (!existing) return NextResponse.json({ order: null });
    return NextResponse.json({
      order: {
        curso: existing.order.curso,
        email: existing.order.email,
        total: Number(existing.order.totalPrice),
        confirmedAt: existing.order.confirmedAt,
      },
      cods: existing.cods,
    });
  } catch (error) {
    console.error('Error en orders GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

const orderSchema = z.object({
  identificador: z.string().min(3),
  studentId: z.string().uuid(),
  curso: z.string().min(1),
  email: z.string().email().or(z.literal('')).optional(),
  cods: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    const { identificador, studentId, curso, email, cods } = parsed.data;

    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ error: 'No hay campaña abierta' }, { status: 404 });
    if (!campaignAbierta(campaign)) {
      return NextResponse.json({ error: 'El plazo de petición de licencias ya se ha cerrado' }, { status: 409 });
    }
    const candidatos = await identifyStudentsByFamily(campaign.id, identificador);
    if (!candidatos.some((c) => c.id === studentId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const student = await getStudentById(studentId);
    if (!student) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

    const cleanEmail = email?.trim() ?? '';
    const result = await upsertOrder(student, curso, cleanEmail, cods);

    // Datos para los correos (precios de confianza desde el catálogo)
    const catalog = await getCatalog(student, curso);
    const byCod = new Map(catalog.map((b) => [b.cod, b]));
    const items = cods
      .filter((c) => byCod.has(c))
      .map((c) => ({ asignatura: byCod.get(c)!.asignatura, precio: byCod.get(c)!.precio }));

    const origin = new URL(request.url).origin;
    const emailData = {
      alumno: maskAlumno(student.nombre, student.apellido1, student.apellido2 ?? student.apellidos),
      curso: cursoLabel(curso),
      email: cleanEmail,
      items,
      total: result.total,
      editUrl: `${origin}/licencias`,
      deadline: campaign.orderDeadline,
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
