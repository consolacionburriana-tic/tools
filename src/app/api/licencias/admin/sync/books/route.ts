import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { getBooksSyncPlan, getCurrentCampaign, syncBooksFromSheet } from '@/lib/licencias-server';


// Vista previa (no escribe nada): qué cambiaría si se sincroniza el catálogo ahora
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });
  try {
    const plan = await getBooksSyncPlan(campaign.id);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('Error generando la vista previa de libros:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Importa/actualiza el catálogo de libros desde la pestaña "BBDD Libros" del Google Sheet
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  try {
    const result = await syncBooksFromSheet(campaign.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error sincronizando libros desde Google Sheets:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
