import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign, syncBooksFromSheet } from '@/lib/licencias-server';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
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
