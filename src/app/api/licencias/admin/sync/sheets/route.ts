import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getSheetSyncData } from '@/lib/licencias-exports';
import { syncOrdersToSheet } from '@/lib/google-sheets';
import { getCurrentCampaign } from '@/lib/licencias-server';

async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

// Sincroniza los pedidos activos (no archivados) con las pestañas "SI/NO BdL - FORM26"
// del Google Sheet histórico. Solo escribe datos de identidad/licencias; nunca toca
// las columnas de estado Q🧾/R📤/S💰 ni sus fechas compañeras (Z/AA) — ver google-sheets.ts.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  try {
    const { si, no } = await getSheetSyncData(campaign.id);
    const [resSi, resNo] = await Promise.all([
      syncOrdersToSheet('SI BdL - FORM26', si),
      syncOrdersToSheet('NO BdL - FORM26', no),
    ]);
    return NextResponse.json({ ok: true, si: resSi, no: resNo });
  } catch (error) {
    console.error('Error sincronizando con Google Sheets:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
