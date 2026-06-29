import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign, getRecipients } from '@/lib/licencias-server';
import { sendBlast, sendBlastTest } from '@/lib/licencias-email';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { accion, grupo, subject, body, testEmail } = (await request.json()) as {
    accion: 'count' | 'test' | 'send';
    grupo: 'faltan' | 'tienen';
    subject?: string;
    body?: string;
    testEmail?: string;
  };
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  const recipients = await getRecipients(campaign.id, grupo === 'tienen' ? 'tienen' : 'faltan');
  const sample = recipients[0] ?? { email: '', nombre: 'Alumno', apellidos: 'Ejemplo', curso: '1ESO' };

  if (accion === 'count') {
    return NextResponse.json({ count: recipients.length });
  }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Asunto y mensaje obligatorios' }, { status: 400 });
  }
  if (accion === 'test') {
    if (!testEmail?.trim()) return NextResponse.json({ error: 'Falta el correo de prueba' }, { status: 400 });
    const status = await sendBlastTest(testEmail.trim(), subject, body, sample);
    return NextResponse.json({ ok: status === 'sent', status });
  }
  if (accion === 'send') {
    const res = await sendBlast(recipients, subject, body);
    return NextResponse.json({ ok: true, ...res });
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
