import { NextResponse } from 'next/server';
import { getCurrentCampaign, identifyStudentsByFamily } from '@/lib/licencias-server';

// Identificación de la familia: DNI/NIE del tutor, NIA del alumno o token de acceso.
// La respuesta solo lleva nombres enmascarados; si no hay match, mensaje genérico
// (nunca confirmamos si un DNI existe o no).
export async function POST(request: Request) {
  try {
    const { identificador } = (await request.json()) as { identificador?: string };
    if (!identificador?.trim()) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }
    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ error: 'No hay campaña' }, { status: 404 });

    const candidates = await identifyStudentsByFamily(campaign.id, identificador);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error en identify:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
