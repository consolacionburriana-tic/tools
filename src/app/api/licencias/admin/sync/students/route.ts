import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign, getStudentsSyncPlan, syncStudentsFromSheet } from '@/lib/licencias-server';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

// Vista previa (no escribe nada): qué cambiaría si se sincroniza el alumnado ahora
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  try {
    const plan = await getStudentsSyncPlan(campaign.id);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('Error generando la vista previa de alumnos:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Importa/actualiza el alumnado desde la pestaña "BBDD Alumnos" del Google Sheet.
// Upsert por código (nunca borra): quien ya no esté en el Sheet se desactiva, para no
// romper los pedidos ya hechos que referencian a ese alumno.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  try {
    const result = await syncStudentsFromSheet(campaign.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error sincronizando alumnos desde Google Sheets:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
