import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { ensureTokens, revocarTokens } from '@/lib/fam-tokens-server';
import { getCurrentCampaign, getEstadoAccesos, getFamiliaRecipients, type ClaseLic } from '@/lib/licencias-server';

const isAdmin = () => hasModule('licencias');

interface Payload {
  accion: 'estado' | 'generar' | 'revocar';
  clases?: ClaseLic[];
  /** Días de validez de los enlaces nuevos (por defecto 120). */
  diasValidez?: number;
}

const DIAS_VALIDEZ_DEFECTO = 120;

// Generación/estado de los enlaces de acceso de las familias de la campaña.
// Nota: el envío de correos (`/api/licencias/admin/correos`) ya genera los que falten, así
// que esta pantalla es para adelantarse (o para exportar los enlaces y usarlos por fuera).
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const p = (await request.json()) as Payload;
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  if (p.accion === 'revocar') {
    const revocados = await revocarTokens('licencias');
    return NextResponse.json({ ok: true, revocados });
  }

  if (p.accion === 'generar') {
    const { familias } = await getFamiliaRecipients(campaign.id, { clases: p.clases ?? [] });
    const dias = p.diasValidez && p.diasValidez > 0 ? p.diasValidez : DIAS_VALIDEZ_DEFECTO;
    const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const tokens = await ensureTokens(familias, { proposito: 'licencias', expiresAt });
    const nuevos = [...tokens.values()].filter((t) => t.nuevo).length;
    return NextResponse.json({
      ok: true,
      familias: familias.length,
      nuevos,
      reutilizados: familias.length - nuevos,
      caducan: expiresAt.toISOString(),
      estado: await getEstadoAccesos(campaign.id),
    });
  }

  return NextResponse.json(await getEstadoAccesos(campaign.id));
}
